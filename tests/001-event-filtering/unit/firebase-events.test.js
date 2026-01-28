import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryEvents } from '@/lib/firebase-events'
import * as firestore from 'firebase/firestore'

// Mock Firestore
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore')
  return {
    ...actual,
    getDocs: vi.fn(),
    query: vi.fn(),
    collection: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    Timestamp: {
      fromDate: vi.fn((date) => ({ toDate: () => date })),
    },
  }
})

// Mock firebase-client
vi.mock('@/lib/firebase-client', () => ({
  db: {},
}))

describe('Event Filtering Logic (Unit) - Feature 001', () => {
  const mockEvents = [
    { id: '1', city: '臺北市', distanceKm: 5, remainingSeats: 5 },
    { id: '2', city: '臺中市', distanceKm: 10, remainingSeats: 0 },
    { id: '3', city: '高雄市', distanceKm: 5.4, remainingSeats: 2 },
    { id: '4', city: '臺北市', distanceKm: 10.5, remainingSeats: 1 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // 預設 Mock getDocs 回傳 mockEvents
    firestore.getDocs.mockResolvedValue({
      docs: mockEvents.map(ev => ({
        id: ev.id,
        data: () => ev
      }))
    })
  })

  // 1. 單一地點篩選 (US4)
  it('應在記憶體中正確過濾地點 (In-Memory Filtering)', async () => {
    const filters = { city: '臺中市' }
    const results = await queryEvents(filters)
    
    // 驗證 Firestore 沒有被呼叫 city 查詢 (因為移至記憶體處理以避免索引問題)
    expect(firestore.where).not.toHaveBeenCalledWith('city', '==', '臺中市')

    // 驗證結果確實只包含臺中市的活動
    expect(results.length).toBe(1)
    expect(results[0].city).toBe('臺中市')
  })

  // 2. 距離寬容度 (US2)
  it('應正確處理距離寬容度 ±0.5km', async () => {
    // 假設 Firestore 回傳了所有 4 筆資料
    const filters = { minDistance: 5, maxDistance: 10 }
    const results = await queryEvents(filters)
    
    // 預期結果：
    // id 1: 5km (符合 [4.5, 10.5])
    // id 2: 10km (符合 [4.5, 10.5])
    // id 3: 5.4km (符合 [4.5, 10.5])
    // id 4: 10.5km (符合 [4.5, 10.5])
    expect(results.length).toBe(4)
    
    // 如果過濾 11km (max 10)
    const filters2 = { maxDistance: 5 }
    const results2 = await queryEvents(filters2)
    // id 1: 5 (符合 <= 5.5)
    // id 3: 5.4 (符合 <= 5.5)
    expect(results2.some(r => r.id === '1')).toBe(true)
    expect(results2.some(r => r.id === '3')).toBe(true)
    expect(results2.length).toBe(2)
  })

  // 3. 名額狀況 (US3)
  it('當 hasSeatsOnly 為 true 時，應過濾掉額滿活動', async () => {
    const results = await queryEvents({ hasSeatsOnly: true })
    
    // id 2 (remainingSeats: 0) 應該被過濾掉
    expect(results.some(r => r.id === '2')).toBe(false)
    expect(results.length).toBe(3)
  })
})