import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useEventEditForm from '@/runtime/hooks/useEventEditForm';
import {
  buildRoutePayload,
  prepareEventUpdateFields,
} from '@/service/event-service';
import {
  createEvent,
  createRouteCoordinates,
  toDatetimeLocalString,
} from '../../_helpers/use-event-edit-form-test-helpers';

/**
 * 建立測試用既有 route payload。
 * @returns {import('@/service/event-service').EventData['route']} 已壓縮的路線資料。
 */
function createStoredRoute() {
  return buildRoutePayload(createRouteCoordinates());
}

/**
 * 將 hook 回傳的變更物件拆成可餵給 service 的 `id` 與 `updatedFields`。
 * @param {Record<string, unknown>} changes - `buildChanges()` 的回傳值。
 * @returns {{ id: string, updatedFields: Record<string, unknown> }} 可安全傳入 service 的參數。
 */
function splitChanges(changes) {
  const { id, ...updatedFields } = changes;
  return {
    id: String(id),
    updatedFields,
  };
}

describe('useEventEditForm', () => {
  it('預填初值、route mode 與 maxParticipantsMin 對齊 event prop', () => {
    const event = createEvent({ route: createStoredRoute(), participantsCount: 7, paceSec: 305 });
    const { result } = renderHook(() => useEventEditForm(event));

    expect(result.current.formTitle).toBe('晨跑團');
    expect(result.current.formTime).toBe(toDatetimeLocalString('2026-05-10T07:00:00'));
    expect(result.current.formDeadline).toBe(toDatetimeLocalString('2026-05-09T20:00:00'));
    expect(result.current.formMeetPlace).toBe('大安森林公園');
    expect(result.current.formDistance).toBe('5');
    expect(result.current.formMaxParticipants).toBe('10');
    expect(result.current.formPaceMin).toBe('05');
    expect(result.current.formPaceSec).toBe('05');
    expect(result.current.formDescription).toBe('輕鬆配速');
    expect(result.current.formCity).toBe('台北市');
    expect(result.current.formDistrict).toBe('大安區');
    expect(result.current.formRunType).toBe('easy');
    expect(result.current.routeMode).toBe('view');
    expect(result.current.maxParticipantsMin).toBe(7);
  });

  it('缺欄位或不可解析時間時 fallback 為空字串，且無 route 時 mode 為 none', () => {
    const event = createEvent({
      title: '',
      time: '',
      registrationDeadline: '',
      meetPlace: '',
      description: '',
      city: '',
      district: '',
      runType: '',
    });
    const { result } = renderHook(() => useEventEditForm(event));

    expect(result.current.formTitle).toBe('');
    expect(result.current.formTime).toBe('');
    expect(result.current.formDeadline).toBe('');
    expect(result.current.formMeetPlace).toBe('');
    expect(result.current.formDescription).toBe('');
    expect(result.current.formCity).toBe('');
    expect(result.current.formDistrict).toBe('');
    expect(result.current.formRunType).toBe('');
    expect(result.current.routeMode).toBe('none');
    expect(result.current.maxParticipantsMin).toBe(3);
  });

  it('一般欄位改動會進入 dirty，改回原值後恢復乾淨', () => {
    const { result } = renderHook(() => useEventEditForm(createEvent()));

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setFormTitle('夜跑團');
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.setFormTitle('晨跑團');
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('route 清除與重畫會正確更新 dirty 狀態與 routeCleared', () => {
    const withRoute = createEvent({ route: createStoredRoute() });
    const { result: routed } = renderHook(() => useEventEditForm(withRoute));

    act(() => {
      routed.current.setRouteCleared(true);
    });
    expect(routed.current.isDirty).toBe(true);

    act(() => {
      routed.current.handleRouteDrawn(createRouteCoordinates());
    });
    expect(routed.current.routeCleared).toBe(false);
    expect(routed.current.editedRouteCoordinates).toEqual(createRouteCoordinates());
    expect(routed.current.isDirty).toBe(true);

    const { result: clean } = renderHook(() => useEventEditForm(createEvent()));
    act(() => {
      clean.current.setRouteCleared(true);
    });
    expect(clean.current.isDirty).toBe(false);
  });

  it('未修改時 buildChanges 只回 id', () => {
    const event = createEvent();
    const { result } = renderHook(() => useEventEditForm(event));

    expect(result.current.buildChanges()).toEqual({ id: 'evt-1' });
  });

  it('變更後的 payload 可直接餵給真實 service update contract', () => {
    const event = createEvent({ route: createStoredRoute() });
    const routeCoordinates = createRouteCoordinates();
    const { result } = renderHook(() => useEventEditForm(event));

    act(() => {
      result.current.setFormTitle('夜跑團');
      result.current.setFormTime('2026-05-10T19:00');
      result.current.setFormDeadline('2026-05-10T17:30');
      result.current.setFormDistance('8');
      result.current.setFormMaxParticipants('12');
      result.current.setFormPaceMin('07');
      result.current.setFormPaceSec('30');
      result.current.setFormCity('新北市');
      result.current.setFormDistrict('板橋區');
      result.current.setFormRunType('interval');
      result.current.handleRouteDrawn(routeCoordinates);
    });

    const changes = result.current.buildChanges();
    const { id, updatedFields } = splitChanges(changes);
    const prepared = prepareEventUpdateFields(id, updatedFields, event);

    expect(changes).toMatchObject({
      id: 'evt-1',
      title: '夜跑團',
      time: '2026-05-10T19:00',
      registrationDeadline: '2026-05-10T17:30',
      distanceKm: 8,
      maxParticipants: 12,
      paceSec: 450,
      city: '新北市',
      district: '板橋區',
      runType: 'interval',
      route: buildRoutePayload(routeCoordinates),
    });
    expect(toDatetimeLocalString(prepared.time.toDate().toISOString())).toBe('2026-05-10T19:00');
    expect(toDatetimeLocalString(prepared.registrationDeadline.toDate().toISOString())).toBe(
      '2026-05-10T17:30',
    );
    expect(prepared.maxParticipants).toBe(12);
    expect(prepared.remainingSeats).toBe(9);
    expect(prepared.paceSec).toBe(450);
    expect(prepared.route).toEqual(buildRoutePayload(routeCoordinates));
  });

  it('清除既有 route 時 payload 會被真實 service 轉成 delete sentinel', () => {
    const event = createEvent({ route: createStoredRoute() });
    const { result } = renderHook(() => useEventEditForm(event));

    act(() => {
      result.current.setRouteCleared(true);
    });

    const { id, updatedFields } = splitChanges(result.current.buildChanges());
    const prepared = prepareEventUpdateFields(id, updatedFields, event, '__DELETE__');

    expect(updatedFields.route).toBeNull();
    expect(prepared.route).toBe('__DELETE__');
  });

  it('deadline 晚於活動時間時，真實 service 會拒絕這份 edit payload', () => {
    const event = createEvent();
    const { result } = renderHook(() => useEventEditForm(event));

    act(() => {
      result.current.setFormTime('2026-05-10T19:00');
      result.current.setFormDeadline('2026-05-10T19:30');
    });

    const { id, updatedFields } = splitChanges(result.current.buildChanges());

    expect(() => prepareEventUpdateFields(id, updatedFields, event)).toThrow(
      '報名截止時間必須在活動開始時間之前',
    );
  });

  it('maxParticipants 低於 participantsCount 時，真實 service 會拒絕這份 edit payload', () => {
    const event = createEvent({ participantsCount: 6, maxParticipants: 10 });
    const { result } = renderHook(() => useEventEditForm(event));

    act(() => {
      result.current.setFormMaxParticipants('5');
    });

    const { id, updatedFields } = splitChanges(result.current.buildChanges());

    expect(() => prepareEventUpdateFields(id, updatedFields, event)).toThrow(
      '人數上限不能低於目前的報名人數',
    );
  });
});
