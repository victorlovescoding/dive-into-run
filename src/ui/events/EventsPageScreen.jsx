'use client';

import EventDeleteConfirm from '@/components/EventDeleteConfirm';
import EventEditForm from '@/components/EventEditForm';
import useEventsPageRuntime from '@/runtime/hooks/useEventsPageRuntime';
import EventCreateForm from './EventCreateForm';
import EventsFilterPanel from './EventsFilterPanel';
import EventsListSection from './EventsListSection';
import styles from './EventsPageScreen.module.css';

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

      <EventsListSection
        events={events}
        user={user}
        isLoadingEvents={isLoadingEvents}
        isFiltering={isFiltering}
        isCreating={isCreating}
        loadError={loadError}
        isFilteredResults={isFilteredResults}
        isLoadingMore={isLoadingMore}
        loadMoreError={loadMoreError}
        hasMore={hasMore}
        sentinelRef={sentinelRef}
        isFormOpen={isFormOpen}
        pendingByEventId={pendingByEventId}
        myJoinedEventIds={myJoinedEventIds}
        getRemainingSeats={getRemainingSeats}
        onJoin={handleJoinClick}
        onLeave={handleLeaveClick}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEventRequest}
        onOpenFilter={handleOpenFilter}
        loadMore={loadMore}
      />

      {!isFormOpen && (
        <button type="button" onClick={handleToggleCreateRunForm} className={styles.mainButton}>
          ＋ 新增跑步揪團
        </button>
      )}

      {isFilterOpen && (
        <EventsFilterPanel
          filterHasSeatsOnly={filterHasSeatsOnly}
          filterTimeStart={filterTimeStart}
          filterTimeEnd={filterTimeEnd}
          filterDistanceMin={filterDistanceMin}
          filterDistanceMax={filterDistanceMax}
          filterCity={filterCity}
          filterDistrict={filterDistrict}
          cityOptions={cityOptions}
          filterDistrictOptions={filterDistrictOptions}
          onHasSeatsOnlyChange={setFilterHasSeatsOnly}
          onTimeStartChange={setFilterTimeStart}
          onTimeEndChange={setFilterTimeEnd}
          onDistanceMinChange={setFilterDistanceMin}
          onDistanceMaxChange={setFilterDistanceMax}
          onCityChange={handleFilterCityChange}
          onDistrictChange={setFilterDistrict}
          onClose={handleCloseFilter}
          onClear={handleClearFilters}
          onSearch={handleSearchFilters}
        />
      )}

      {user?.uid && isFormOpen && (
        <EventCreateForm
          hostName={hostName}
          draftFormData={draftFormData}
          minDateTime={minDateTime}
          selectedCity={selectedCity}
          selectedDistrict={selectedDistrict}
          cityOptions={cityOptions}
          selectedDistrictOptions={selectedDistrictOptions}
          showMap={showMap}
          routeCoordinates={routeCoordinates}
          routePointCount={routePointCount}
          isCreating={isCreating}
          onSubmit={handleSubmit}
          onClose={handleCloseCreateForm}
          onCityChange={handleSelectedCityChange}
          onDistrictChange={setSelectedDistrict}
          onEnableRoute={handleEnableRoutePlanning}
          onDisableRoute={handleDisableRoutePlanning}
          onRouteDrawn={setRouteCoordinates}
        />
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
