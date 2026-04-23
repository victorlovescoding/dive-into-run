'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import EventActionButtons from '@/components/EventActionButtons';
import EventCardMenu from '@/components/EventCardMenu';
import EventDeleteConfirm from '@/components/EventDeleteConfirm';
import EventEditForm from '@/components/EventEditForm';
import UserLink from '@/components/UserLink';
import useEventsPageRuntime from '@/runtime/hooks/useEventsPageRuntime';
import { formatDateTime, formatPace, renderRouteLabel } from './event-formatters';
import styles from './EventsPageScreen.module.css';

const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

/**
 * 揪團跑步頁面 UI screen。
 * @returns {import('react').ReactElement} 頁面內容。
 */
export default function EventsPageScreen() {
  const {
    user,
    events,
    hostName,
    isFormOpen,
    isFilterOpen,
    filterTimeStart,
    filterTimeEnd,
    filterDistanceMin,
    filterDistanceMax,
    filterHasSeatsOnly,
    filterCity,
    filterDistrict,
    showMap,
    routeCoordinates,
    routePointCount,
    selectedCity,
    selectedDistrict,
    minDateTime,
    isFilteredResults,
    isLoadingEvents,
    isFiltering,
    loadError,
    isLoadingMore,
    loadMoreError,
    hasMore,
    sentinelRef,
    isCreating,
    pendingByEventId,
    myJoinedEventIds,
    draftFormData,
    editingEvent,
    isUpdating,
    deletingEventId,
    isDeletingEvent,
    cityOptions,
    filterDistrictOptions,
    selectedDistrictOptions,
    getRemainingSeats,
    setFilterTimeStart,
    setFilterTimeEnd,
    setFilterDistanceMin,
    setFilterDistanceMax,
    setFilterHasSeatsOnly,
    setFilterDistrict,
    setSelectedDistrict,
    setRouteCoordinates,
    handleOpenFilter,
    handleCloseFilter,
    handleFilterCityChange,
    handleSelectedCityChange,
    handleEnableRoutePlanning,
    handleDisableRoutePlanning,
    handleToggleCreateRunForm,
    handleCloseCreateForm,
    handleClearFilters,
    handleSearchFilters,
    handleSubmit,
    handleJoinClick,
    handleLeaveClick,
    handleEditEvent,
    handleEditCancel,
    handleEditSubmit,
    handleDeleteEventRequest,
    handleDeleteCancel,
    handleDeleteConfirm,
    loadMore,
  } = useEventsPageRuntime();

  return (
    <div className={styles.pageContainer}>
      <h1>這是揪團跑步頁面</h1>

      <div className={styles.eventsSection}>
        <div className={styles.eventsHeaderRow}>
          <h2 className={styles.eventsTitle}>活動列表</h2>

          <button
            type="button"
            className={styles.filterButton}
            aria-label="篩選活動"
            onClick={handleOpenFilter}
          >
            <svg
              className={styles.filterIcon}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 5h18l-7 8v5l-4 1v-6L3 5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {isLoadingEvents && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在載入活動…</span>
          </div>
        )}

        {isFiltering && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在篩選活動…</span>
          </div>
        )}

        {isCreating && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在建立活動…</span>
          </div>
        )}

        {loadError && (
          <div className={styles.errorCard} role="alert">
            {loadError}
          </div>
        )}

        <div className={styles.eventList}>
          {!isLoadingEvents && !isFiltering && events.length === 0 ? (
            <div className={styles.emptyHint}>
              {isFilteredResults ? '沒有符合條件的活動' : '目前還沒有活動（先建立一筆看看）'}
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} className={styles.eventCardWrapper}>
                <div className={styles.eventCard}>
                  <Link href={`/events/${event.id}`} className={styles.eventTitleLink}>
                    <div className={styles.eventTitle}>{event.title}</div>
                  </Link>

                  <div className={styles.eventMeta}>
                    <div>
                      時間：
                      {formatDateTime(event.time)}
                    </div>
                    <div>
                      報名截止：
                      {formatDateTime(event.registrationDeadline)}
                    </div>
                    <div>
                      地點：
                      {event.city} {event.district}
                    </div>
                    <div>
                      集合：
                      {event.meetPlace}
                    </div>
                  </div>

                  <div className={styles.eventMeta}>
                    <div>
                      距離：
                      {event.distanceKm} km
                    </div>
                    <div>
                      配速：
                      {formatPace(event.paceSec, event.pace)} /km
                    </div>
                    <div>
                      人數上限：
                      {event.maxParticipants}
                    </div>
                    <div>
                      剩餘名額：
                      {getRemainingSeats(event)}
                    </div>
                  </div>

                  <div className={styles.eventMeta}>
                    <div className={styles.hostRow}>
                      <span>主揪：</span>
                      <UserLink
                        uid={event.hostUid}
                        name={event.hostName}
                        photoURL={event.hostPhotoURL}
                        size={24}
                      />
                    </div>
                    <div>
                      路線：
                      {renderRouteLabel(event)}
                    </div>
                  </div>

                  <div className={styles.eventCardActions}>
                    <EventActionButtons
                      event={event}
                      user={user}
                      onJoin={handleJoinClick}
                      onLeave={handleLeaveClick}
                      isPending={pendingByEventId[String(event.id)]}
                      isCreating={isCreating}
                      isFormOpen={isFormOpen}
                      myJoinedEventIds={myJoinedEventIds}
                    />
                  </div>
                </div>

                <div className={styles.eventCardMenuWrapper}>
                  <EventCardMenu
                    event={event}
                    currentUserUid={user?.uid || null}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEventRequest}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.loadMoreArea}>
          {isLoadingMore && (
            <div className={styles.statusRow} role="status" aria-live="polite">
              <div className={styles.spinner} aria-hidden="true" />
              <span>載入更多活動…</span>
            </div>
          )}

          {loadMoreError && (
            <div className={styles.errorCard} role="alert">
              {loadMoreError}
              <button
                type="button"
                className={styles.retryButton}
                onClick={loadMore}
                disabled={isLoadingMore || isLoadingEvents || isCreating || isFormOpen}
              >
                重試
              </button>
            </div>
          )}

          {!hasMore && events.length > 0 && <div className={styles.endHint}>已經到底了</div>}

          <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
        </div>
      </div>

      {!isFormOpen && (
        <button type="button" onClick={handleToggleCreateRunForm} className={styles.mainButton}>
          ＋ 新增跑步揪團
        </button>
      )}

      {isFilterOpen && (
        <div className={styles.filterOverlay}>
          <div
            className={styles.overlayBackground}
            role="button"
            aria-label="關閉篩選"
            onClick={handleCloseFilter}
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
                handleCloseFilter();
              }
            }}
            tabIndex={0}
          />
          <div
            className={styles.filterCard}
            role="dialog"
            aria-modal="true"
            aria-label="篩選活動詳情"
          >
            <div className={styles.filterHeader}>
              <div className={styles.filterHeaderTitle}>篩選活動</div>
              <button
                type="button"
                className={styles.filterCloseButton}
                aria-label="關閉篩選"
                onClick={handleCloseFilter}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.filterBody}>
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>名額狀況</div>
                <div className={styles.filterToggleRow}>
                  <span className={styles.filterToggleLabel}>只顯示還有名額的活動</span>
                  <label className={styles.switch} htmlFor="filterHasSeatsOnly">
                    <input
                      type="checkbox"
                      id="filterHasSeatsOnly"
                      checked={filterHasSeatsOnly}
                      onChange={(event) => setFilterHasSeatsOnly(event.target.checked)}
                      aria-label="只顯示還有名額的活動"
                    />
                    <span className={`${styles.slider} ${styles.round}`} />
                  </label>
                </div>
              </div>

              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>活動時間</div>
                <div className={styles.filterRow}>
                  <div className={styles.filterRowItem}>
                    <input
                      type="datetime-local"
                      id="filterTimeStart"
                      className={styles.filterTextField}
                      value={filterTimeStart}
                      onChange={(event) => setFilterTimeStart(event.target.value)}
                      aria-label="活動開始時間（起）"
                    />
                  </div>
                  <span className={styles.filterSeparator}>至</span>
                  <div className={styles.filterRowItem}>
                    <input
                      type="datetime-local"
                      id="filterTimeEnd"
                      className={styles.filterTextField}
                      value={filterTimeEnd}
                      onChange={(event) => setFilterTimeEnd(event.target.value)}
                      aria-label="活動開始時間（迄）"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>跑步距離 (km)</div>
                <div className={styles.filterRow}>
                  <div className={styles.filterRowItem}>
                    <input
                      type="number"
                      id="filterDistanceMin"
                      className={styles.filterTextField}
                      placeholder="最小距離"
                      aria-label="最小跑步距離"
                      min={0}
                      step={0.1}
                      value={filterDistanceMin}
                      onChange={(event) => setFilterDistanceMin(event.target.value)}
                    />
                  </div>
                  <span className={styles.filterSeparator}>-</span>
                  <div className={styles.filterRowItem}>
                    <input
                      type="number"
                      id="filterDistanceMax"
                      className={styles.filterTextField}
                      placeholder="最大距離"
                      aria-label="最大跑步距離"
                      min={0}
                      step={0.1}
                      value={filterDistanceMax}
                      onChange={(event) => setFilterDistanceMax(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>活動區域</div>
                <div className={styles.filterRow}>
                  <label htmlFor="filterCity" className={styles.flex1}>
                    <span className={styles.srOnly}>選擇縣市</span>
                    <select
                      id="filterCity"
                      className={styles.selectField}
                      value={filterCity}
                      onChange={(event) => handleFilterCityChange(event.target.value)}
                    >
                      <option value="">所有縣市</option>
                      {cityOptions.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label htmlFor="filterDistrict" className={styles.flex1}>
                    <span className={styles.srOnly}>選擇區域</span>
                    <select
                      id="filterDistrict"
                      className={styles.selectField}
                      value={filterDistrict}
                      onChange={(event) => setFilterDistrict(event.target.value)}
                      disabled={!filterCity}
                    >
                      <option value="">所有區域</option>
                      {filterDistrictOptions.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={styles.filterClearButton}
                  onClick={handleClearFilters}
                >
                  清除
                </button>
                <button
                  type="button"
                  className={styles.filterSearchButton}
                  onClick={handleSearchFilters}
                >
                  搜尋
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.uid && isFormOpen && (
        <div className={styles.formOverlay}>
          <form className={styles.googleFormCard} onSubmit={handleSubmit}>
            <div className={styles.formHeaderAccent} />

            <div className={styles.formHeader}>
              <h2>揪團表單</h2>
              <p className={styles.formDescription}>請填寫詳細資訊讓跑友們加入</p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="hostName">
                揪團人
                <input
                  id="hostName"
                  type="text"
                  name="hostName"
                  value={hostName}
                  readOnly
                  aria-readonly="true"
                  placeholder="將自動帶入您的會員名稱"
                />
              </label>
              <div className={styles.focusBorder} />
              <small className={styles.helperText}>由登入帳號自動帶入，無法修改</small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="title">
                活動名稱
                <input
                  id="title"
                  type="text"
                  name="title"
                  required
                  placeholder="例如：大安森林公園輕鬆跑"
                  defaultValue={draftFormData?.title || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="time">
                活動時間
                <input
                  id="time"
                  type="datetime-local"
                  name="time"
                  min={minDateTime}
                  required
                  defaultValue={draftFormData?.time || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="registrationDeadline">
                報名截止時間
                <input
                  id="registrationDeadline"
                  type="datetime-local"
                  name="registrationDeadline"
                  min={minDateTime}
                  required
                  defaultValue={draftFormData?.registrationDeadline || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="city">
                活動區域
                <div className={styles.flexRowGap10}>
                  <select
                    id="city"
                    name="city"
                    value={selectedCity}
                    onChange={(event) => handleSelectedCityChange(event.target.value)}
                    required
                    className={`${styles.selectField} ${styles.flex1}`}
                  >
                    <option value="" disabled>
                      請選擇縣市
                    </option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>

                  <select
                    id="district"
                    name="district"
                    aria-label="選擇區域"
                    value={selectedDistrict}
                    onChange={(event) => setSelectedDistrict(event.target.value)}
                    required
                    className={`${styles.selectField} ${styles.flex1}`}
                  >
                    <option value="" disabled>
                      請選擇區域
                    </option>
                    {selectedDistrictOptions.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="meetPlace">
                集合地點
                <input
                  id="meetPlace"
                  type="text"
                  name="meetPlace"
                  required
                  placeholder="例如：大安森林公園 2號出口"
                  defaultValue={draftFormData?.meetPlace || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="runType">
                跑步類型
                <select
                  name="runType"
                  id="runType"
                  className={styles.selectField}
                  required
                  defaultValue={draftFormData?.runType || ''}
                >
                  <option value="" disabled>
                    請選擇跑步類型
                  </option>
                  <option value="easy_run">輕鬆慢跑（Easy Run）</option>
                  <option value="long_run">長距離慢跑（Long Run）</option>
                  <option value="tempo_run">節奏跑（Tempo Run）</option>
                  <option value="interval_training">間歇訓練（Interval Training）</option>
                  <option value="hill_training">坡度訓練（Hill Training）</option>
                  <option value="fartlek">變速跑（Fartlek）</option>
                  <option value="trail_run">越野跑（Trail Run）</option>
                  <option value="social_run">休閒社交跑（Social Run）</option>
                </select>
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="distanceKm">
                距離（公里）
                <input
                  id="distanceKm"
                  name="distanceKm"
                  type="number"
                  min={0.1}
                  step={0.1}
                  required
                  placeholder="10"
                  defaultValue={draftFormData?.distanceKm || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>目標配速（每公里）</div>
              <div className={`${styles.flexRowGap10} ${styles.flexAlignCenter}`}>
                <label htmlFor="paceMinutes" className={styles.flexAlignCenter}>
                  <select
                    id="paceMinutes"
                    name="paceMinutes"
                    className={`${styles.selectField} ${styles.centerSelect}`}
                    required
                    defaultValue={draftFormData?.paceMinutes || ''}
                  >
                    <option value="" disabled hidden>
                      分
                    </option>
                    {[...Array(19)].map((_, index) => {
                      const value = String(index + 2).padStart(2, '0');
                      return (
                        <option key={value} value={value}>
                          {index + 2}
                        </option>
                      );
                    })}
                  </select>
                  <span className={styles.paceUnit}>分</span>
                </label>

                <label htmlFor="paceSeconds" className={styles.flexAlignCenter}>
                  <select
                    id="paceSeconds"
                    name="paceSeconds"
                    className={`${styles.selectField} ${styles.centerSelect}`}
                    required
                    defaultValue={draftFormData?.paceSeconds || ''}
                  >
                    <option value="" disabled hidden>
                      秒
                    </option>
                    {[...Array(60).keys()].map((seconds) => {
                      const label = String(seconds).padStart(2, '0');
                      return (
                        <option key={seconds} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <span className={styles.paceUnit}>秒</span>
                </label>
              </div>
              <div className={styles.focusBorder} />
              <small className={styles.helperText}>請選擇每公里的配速時間</small>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>是否需要繪製活動路線？</div>
              <div className={styles.radioGroup}>
                <label htmlFor="planRouteYes">
                  <input
                    type="radio"
                    id="planRouteYes"
                    name="planRoute"
                    value="yes"
                    required
                    defaultChecked={draftFormData?.planRoute === 'yes'}
                    onChange={handleEnableRoutePlanning}
                  />{' '}
                  是
                </label>
                <label htmlFor="planRouteNo">
                  <input
                    type="radio"
                    id="planRouteNo"
                    name="planRoute"
                    value="no"
                    required
                    defaultChecked={draftFormData?.planRoute === 'no'}
                    onChange={handleDisableRoutePlanning}
                  />{' '}
                  否
                </label>
              </div>
              <div className={styles.focusBorder} />
            </div>

            {showMap && (
              <div className={styles.formGroup}>
                <div className={styles.formLabel}>繪製活動路線</div>
                <EventMap onRouteDrawn={setRouteCoordinates} />
                {routeCoordinates && (
                  <p className={styles.helperText}>路線已繪製，包含 {routePointCount} 個點。</p>
                )}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="maxParticipants">
                人數上限
                <input
                  id="maxParticipants"
                  name="maxParticipants"
                  type="number"
                  min={2}
                  defaultValue={draftFormData?.maxParticipants || '2'}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">
                活動說明
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="請說明活動內容、注意事項、集合細節等"
                  className={styles.textareaField}
                  defaultValue={draftFormData?.description || ''}
                />
              </label>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCloseCreateForm}
                disabled={isCreating}
              >
                取消
              </button>
              <button type="submit" className={styles.submitButton} disabled={isCreating}>
                {isCreating ? '建立中…' : '建立活動'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingEvent && (
        <div className={styles.editFormOverlay}>
          <EventEditForm
            event={editingEvent}
            onSubmit={handleEditSubmit}
            onCancel={handleEditCancel}
            isSubmitting={isUpdating}
          />
        </div>
      )}

      {deletingEventId && (
        <div className={styles.deleteConfirmOverlay}>
          <EventDeleteConfirm
            eventId={deletingEventId}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
            isDeleting={isDeletingEvent}
          />
        </div>
      )}
    </div>
  );
}
