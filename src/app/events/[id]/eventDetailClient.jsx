"use client";

/* eslint-disable @next/next/no-img-element */

import { useContext, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import styles from "../events.module.css";
import { AuthContext } from "@/contexts/AuthContext";
import {
  fetchEventById,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
  joinEvent,
  leaveEvent,
} from "@/lib/firebase-events";

// Leaflet 只能在瀏覽器端跑
const EventMap = dynamic(() => import("@/components/EventMap"), { ssr: false });

function formatDateTime(value) {
  if (!value) return "";

  // datetime-local 字串（例如 2025-12-27T13:17）
  if (typeof value === "string") {
    return value.replace("T", " ");
  }

  // Firestore Timestamp（有 toDate 方法）
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  return String(value);
}

function computeStatus({ time, registrationDeadline }) {
  const now = Date.now();

  const toMs = (v) => {
    if (!v) return null;
    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    }
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    return null;
  };

  const t = toMs(time);
  const ddl = toMs(registrationDeadline);

  if (t && now >= t) return "活動已開始";
  if (ddl && now >= ddl) return "報名已截止";
  return "報名中";
}

function toNumber(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getRemainingSeats(ev, fallbackParticipantsCount = 0) {
  if (typeof ev?.remainingSeats === "number") return ev.remainingSeats;
  const max = toNumber(ev?.maxParticipants);
  const count =
    typeof ev?.participantsCount === "number"
      ? ev.participantsCount
      : fallbackParticipantsCount;
  return Math.max(0, max - toNumber(count));
}

function buildUserPayload(user) {
  if (!user?.uid) return null;
  return {
    uid: String(user.uid),
    name: String(user.name || (user.email ? user.email.split("@")[0] : "")),
    photoURL: String(user.photoURL || ""),
  };
}

export default function EventDetailClient({ id }) {
  const { user } = useContext(AuthContext);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // participants
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState(null);
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);

  // join/leave UI
  const [actionMessage, setActionMessage] = useState(null);
  const [pending, setPending] = useState(null); // 'joining' | 'leaving' | null
  const [isJoined, setIsJoined] = useState(false);

  const refreshParticipants = useCallback(async () => {
    if (!id) return;

    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const list = await fetchParticipants(id, 200);
      setParticipants(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("讀取參加名單失敗:", err);
      setParticipantsError("讀取參加名單失敗，請稍後再試");
    } finally {
      setParticipantsLoading(false);
    }
  }, [id]);

  // 讀活動詳情
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchEventById(id);
        if (cancelled) return;

        if (!data) {
          setEvent(null);
          setError("找不到這個活動（可能已被刪除）");
          return;
        }

        setEvent(data);
      } catch (err) {
        console.error("讀取活動詳情失敗:", err);
        if (!cancelled) setError("讀取活動詳情失敗，請稍後再試");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 進頁就抓參加名單
  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);

  // 查「我是否已參加」(避免靠 participants 陣列判斷會受 limit 影響)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsJoined(false);
      if (!user?.uid || !id) return;

      try {
        const set = await fetchMyJoinedEventsForIds(user.uid, [String(id)]);
        if (cancelled) return;
        setIsJoined(set instanceof Set ? set.has(String(id)) : false);
      } catch (err) {
        console.error("查詢是否已參加失敗:", err);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, id]);

  // overlay 開啟時鎖住 body 滾動
  useEffect(() => {
    if (!isParticipantsOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isParticipantsOpen]);

  const statusText = useMemo(() => {
    if (!event) return "";
    return computeStatus({
      time: event.time,
      registrationDeadline: event.registrationDeadline,
    });
  }, [event]);

  const hasRoute = Boolean(event?.route?.polyline);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.eventsSection}>
        <Link
          href="/events"
          className={styles.backLink}
        >
          ← 回到活動列表
        </Link>

        {loading && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在載入活動詳情…</span>
          </div>
        )}

        {error && (
          <div className={styles.errorCard} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && event && (
          <>
            {/* 基本資訊 */}
            <div className={styles.eventCard}>
              <div className={styles.detailHeader}>
                <div className={styles.eventTitle}>{event.title}</div>
                <div className={styles.statusPill}>{statusText}</div>
              </div>

              <div className={styles.eventMeta}>
                <div>時間：{formatDateTime(event.time)}</div>
                <div>
                  報名截止：{formatDateTime(event.registrationDeadline)}
                </div>
                <div>
                  地點：{event.city} {event.district}
                </div>
                <div>集合：{event.meetPlace}</div>
              </div>

              <div className={styles.eventMeta}>
                <div>距離：{event.distanceKm} km</div>
                <div>配速：{event.pace} /km</div>
                <div>人數上限：{event.maxParticipants}</div>
                <div>
                  剩餘名額：{getRemainingSeats(event, participants.length)}
                </div>
              </div>

              <div className={styles.eventMeta}>
                <div>主揪：{event.hostName}</div>
              </div>

              {/* ✅ 參加/退出 + 參加名單 */}
              <div className={styles.detailActions}>
                {/* 參加名單 */}
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={async () => {
                    setParticipantsOpen(true);
                    await refreshParticipants();
                  }}
                >
                  看看誰有參加
                </button>

                {/* 參加/退出 */}
                {user?.uid && event.hostUid === user.uid ? null : !user?.uid ? (
                  <div
                    className={`${styles.helperText} ${styles.alignSelfCenter}`}
                  >
                    加入活動前請先登入
                  </div>
                ) : (
                  (() => {
                    const remaining = getRemainingSeats(
                      event,
                      participants.length
                    );

                    if (isJoined) {
                      return (
                        <button
                          type="button"
                          className={`${styles.submitButton} ${styles.leaveButton}`}
                          onClick={async () => {
                            if (!user?.uid) return;
                            const payload = buildUserPayload(user);
                            if (!payload) return;

                            setActionMessage(null);
                            setPending("leaving");
                            try {
                              const res = await leaveEvent(String(id), payload);
                              if (
                                res?.ok &&
                                (res.status === "left" ||
                                  res.status === "not_joined")
                              ) {
                                setIsJoined(false);

                                // UI 快取更新（counts/seats + participants list）
                                setEvent((prev) => {
                                  if (!prev) return prev;
                                  const max = toNumber(prev.maxParticipants);
                                  const prevCount = toNumber(
                                    prev.participantsCount ??
                                      participants.length
                                  );
                                  const prevRemaining = getRemainingSeats(
                                    prev,
                                    participants.length
                                  );
                                  return {
                                    ...prev,
                                    participantsCount: Math.max(
                                      0,
                                      prevCount - 1
                                    ),
                                    remainingSeats: Math.min(
                                      max,
                                      prevRemaining + 1
                                    ),
                                  };
                                });

                                setParticipants((prev) =>
                                  prev.filter(
                                    (p) => String(p.uid) !== String(user.uid)
                                  )
                                );

                                setActionMessage({
                                  type: "success",
                                  message: "已成功取消報名",
                                });
                              } else {
                                setActionMessage({
                                  type: "error",
                                  message: "發生錯誤，請再重新取消報名",
                                });
                              }
                            } catch (err) {
                              console.error("退出活動失敗:", err);
                              setActionMessage({
                                type: "error",
                                message: "發生錯誤，請再重新取消報名",
                              });
                            } finally {
                              setPending(null);
                            }
                          }}
                          disabled={pending != null}
                        >
                          {pending === "leaving" ? (
                            <span className={styles.spinnerLabel}>
                              <div
                                className={`${styles.spinner} ${styles.buttonSpinner}`}
                              />
                              取消中…
                            </span>
                          ) : (
                            "退出活動"
                          )}
                        </button>
                      );
                    }

                    if (remaining <= 0) {
                      return (
                        <button
                          type="button"
                          className={`${styles.submitButton} ${styles.soldOutButton}`}
                          disabled
                          aria-disabled="true"
                        >
                          已額滿
                        </button>
                      );
                    }

                    return (
                      <button
                        type="button"
                        className={styles.submitButton}
                        onClick={async () => {
                          if (!user?.uid) return;
                          const payload = buildUserPayload(user);
                          if (!payload) return;

                          setActionMessage(null);
                          setPending("joining");
                          try {
                            const res = await joinEvent(String(id), payload);

                            if (
                              res?.ok &&
                              (res.status === "joined" ||
                                res.status === "already_joined")
                            ) {
                              setIsJoined(true);

                              if (res.status === "joined") {
                                // UI 快取更新（counts/seats + participants list）
                                setEvent((prev) => {
                                  if (!prev) return prev;
                                  const prevCount = toNumber(
                                    prev.participantsCount ??
                                      participants.length
                                  );
                                  const prevRemaining = getRemainingSeats(
                                    prev,
                                    participants.length
                                  );
                                  return {
                                    ...prev,
                                    participantsCount: prevCount + 1,
                                    remainingSeats: Math.max(
                                      0,
                                      prevRemaining - 1
                                    ),
                                  };
                                });

                                setParticipants((prev) => {
                                  const uid = String(user.uid);
                                  if (prev.some((p) => String(p.uid) === uid))
                                    return prev;
                                  return [
                                    {
                                      id: uid,
                                      uid,
                                      name: payload.name,
                                      photoURL: payload.photoURL,
                                      eventId: String(id),
                                    },
                                    ...prev,
                                  ];
                                });
                              }

                              setActionMessage({
                                type: "success",
                                message: "報名成功",
                              });
                            } else if (
                              res?.ok === false &&
                              res.status === "full"
                            ) {
                              setActionMessage({
                                type: "error",
                                message: "本活動已額滿",
                              });
                              setEvent((prev) =>
                                prev ? { ...prev, remainingSeats: 0 } : prev
                              );
                            } else {
                              setActionMessage({
                                type: "error",
                                message: "報名失敗，請再試一次",
                              });
                            }
                          } catch (err) {
                            console.error("參加活動失敗:", err);
                            setActionMessage({
                              type: "error",
                              message: "報名失敗，請再試一次",
                            });
                          } finally {
                            setPending(null);
                          }
                        }}
                        disabled={pending != null}
                      >
                        {pending === "joining" ? (
                          <span className={styles.spinnerLabel}>
                            <div
                              className={`${styles.spinner} ${styles.buttonSpinner}`}
                            />
                            報名中…
                          </span>
                        ) : (
                          "參加活動"
                        )}
                      </button>
                    );
                  })()
                )}
              </div>

              {/* ✅ 成功/失敗字卡（同 events 頁） */}
              {actionMessage && (
                <div
                  className={styles.errorCard}
                  role={actionMessage.type === "error" ? "alert" : "status"}
                  style={
                    actionMessage.type === "success"
                      ? {
                          background: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                          color: "#065f46",
                        }
                      : undefined
                  }
                >
                  {actionMessage.message}
                </div>
              )}
            </div>

            {/* 活動說明 */}
            <div className={styles.eventCard}>
              <div className={`${styles.eventTitle} ${styles.fontSize16}`}>
                活動說明
              </div>
              <div className={styles.eventMeta}>
                {event.description?.trim()
                  ? event.description
                  : "尚未填寫活動說明"}
              </div>
            </div>

            {/* 路線 */}
            <div className={styles.eventCard}>
              <div className={`${styles.eventTitle} ${styles.fontSize16}`}>
                活動路線
              </div>

              {!hasRoute ? (
                <div className={styles.eventMeta}>此活動未設定路線</div>
              ) : (
                <>
                  <div className={styles.eventMeta}>
                    已設定路線（{event.route?.pointsCount ?? "?"} 點）
                  </div>

                  <div className={styles.detailMapContainer}>
                    <EventMap
                      mode="view"
                      encodedPolyline={event.route.polyline}
                      bbox={event.route.bbox}
                      height={420}
                    />
                  </div>
                </>
              )}
            </div>

            {/* ✅ Participants Overlay */}
            {isParticipantsOpen && (
              <div
                role="dialog"
                aria-modal="true"
                className={styles.participantsOverlay}
                onClick={() => setParticipantsOpen(false)}
              >
                <div
                  className={styles.participantsCard}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.participantsHeader}>
                    <div className={styles.participantsTitle}>參加名單</div>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setParticipantsOpen(false)}
                    >
                      關閉
                    </button>
                  </div>

                  <div className={styles.participantsBody}>
                    {participantsLoading && (
                      <div
                        className={`${styles.statusRow} ${styles.marginBottom12}`}
                        role="status"
                        aria-live="polite"
                      >
                        <div className={styles.spinner} aria-hidden="true" />
                        <span>正在載入參加名單…</span>
                      </div>
                    )}

                    {participantsError && (
                      <div className={styles.errorCard} role="alert">
                        {participantsError}
                        <button
                          type="button"
                          className={`${styles.retryButton} ${styles.marginLeft10}`}
                          onClick={refreshParticipants}
                        >
                          重試
                        </button>
                      </div>
                    )}

                    {!participantsLoading &&
                    !participantsError &&
                    participants.length === 0 ? (
                      <div className={styles.emptyHint}>目前還沒有人報名</div>
                    ) : (
                      <div className={styles.participantsList}>
                        {participants.map((p) => (
                          <div
                            key={String(p.uid || p.id)}
                            className={styles.participantItem}
                          >
                            {p.photoURL ? (
                              <img
                                src={p.photoURL}
                                alt={
                                  p.name ? `${p.name} 的大頭貼` : "參加者大頭貼"
                                }
                                width={36}
                                height={36}
                                className={styles.participantAvatar}
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                className={styles.participantFallbackAvatar}
                              >
                                {(p.name || "?").slice(0, 1)}
                              </div>
                            )}

                            <div className={styles.participantInfo}>
                              <div className={styles.participantName}>
                                {p.name || "（未命名）"}
                              </div>
                              <div className={styles.participantStatus}>
                                已參加
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
