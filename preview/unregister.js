// Eski (v3.7) önizlemenin servis çalışanı bu kapsamda kayıtlıysa kaldırılır. Önbelleklere ve verilere dokunulmaz.
if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then((rs) => rs.filter((r) => /\/preview\/$/.test(r.scope)).forEach((r) => r.unregister()));
