/**
 * For `.catch(actionFailed)` on a server action called from the browser: a
 * dropped connection or a server crash becomes an ordinary failed result, so
 * the screen shows a message instead of a stuck spinner or an error page.
 */
export function actionFailed(): { ok: false; error: string } {
  return { ok: false, error: "A művelet nem sikerült. Ellenőrizd az internetkapcsolatot, és próbáld újra." };
}
