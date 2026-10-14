const $ = (id) => document.getElementById(id);
let hindi = false;
let paid = localStorage.getItem("connectlive_demo_paid") === "yes";
let ws = null, pc = null, localStream = null, peerId = null, muted = false, activeCall = false;
const transactionsKey = "connectlive_demo_transactions";
const iceConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function t(en, hi) { return hindi ? hi : en; }
function setStatus(text) { $("callStatus").textContent = text; }
function updateAccess() {
  $("accessBadge").innerHTML = paid ? "✓ " + t("Demo access unlocked", "डेमो एक्सेस चालू") : "🔒 " + t("Access locked", "एक्सेस लॉक है");
  $("findBtn").disabled = !paid;
}
function setCallButtons(inCall) {
  $("nextBtn").disabled = !paid;
  $("muteBtn").disabled = !inCall;
  $("endBtn").disabled = !inCall;
  $("reportBtn").disabled = !inCall;
  $("blockBtn").disabled = !inCall;
  $("findBtn").disabled = !paid || inCall;
}
function showLocal(stream) {
  $("localVideo").srcObject = stream;
  $("localVideo").style.display = "block";
  $("localPlaceholder").style.display = "none";
}
function clearRemote() {
  $("remoteVideo").srcObject = null;
  $("remoteVideo").style.display = "none";
  $("remotePlaceholder").style.display = "flex";
}
function closePeer() {
  if (pc) { pc.ontrack = null; pc.onicecandidate = null; pc.close(); pc = null; }
  $("remoteVideo").srcObject = null;
  $("remoteVideo").style.display = "none";
  $("remotePlaceholder").style.display = "flex";
}
function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function connectSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}`);
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("Could not connect to the matching server."));
    ws.onmessage = async (event) => {
      let msg; try { msg = JSON.parse(event.data); } catch { return; }
      try {
        if (msg.type === "waiting") setStatus(t("Waiting for another person…", "दूसरे व्यक्ति का इंतज़ार हो रहा है…"));
        if (msg.type === "matched") {
          peerId = msg.room; activeCall = true;
          setStatus(t("Connected. Say hello!", "कनेक्शन हो गया। नमस्ते कहें!"));
          $("remotePlaceholder").style.display = "none";
          if (msg.initiator) {
            await ensurePeer();
            const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
            send({ type: "offer", payload: pc.localDescription });
          }
          setCallButtons(true);
        }
        if (msg.type === "offer") {
          await ensurePeer(); await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
          send({ type: "answer", payload: pc.localDescription });
        }
        if (msg.type === "answer" && pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        if (msg.type === "ice" && pc && msg.payload) {
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.payload)); } catch (e) { console.warn(e); }
        }
        if (msg.type === "peer-left") {
          closePeer(); activeCall = false; peerId = null; setCallButtons(false);
          setStatus(t("The other person left. Find someone new.", "दूसरे व्यक्ति ने कॉल छोड़ दी। किसी और से जुड़ें।"));
        }
        if (msg.type === "report-received") alert(t("Report submitted for this prototype session.", "इस प्रोटोटाइप सेशन की रिपोर्ट दर्ज हुई।"));
        if (msg.type === "blocked") alert(t("User blocked for this session. No permanent account block is stored in this prototype.", "इस सेशन में यूज़र ब्लॉक किया गया। प्रोटोटाइप में स्थायी ब्लॉक सेव नहीं होता।"));
      } catch (err) { console.error(err); setStatus(t("Call setup failed. Try again.", "कॉल शुरू नहीं हो पाई। फिर कोशिश करें।")); }
    };
  });
}
async function ensurePeer() {
  if (pc) return;
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    showLocal(localStream);
  }
  pc = new RTCPeerConnection(iceConfig);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.ontrack = (event) => {
    $("remoteVideo").srcObject = event.streams[0];
    $("remoteVideo").style.display = "block";
    $("remotePlaceholder").style.display = "none";
  };
  pc.onicecandidate = (event) => { if (event.candidate) send({ type: "ice", payload: event.candidate }); };
  pc.onconnectionstatechange = () => {
    if (pc && ["failed", "disconnected"].includes(pc.connectionState)) setStatus(t("Connection interrupted. You can try Next.", "कनेक्शन बाधित है। Next दबाकर कोशिश करें।"));
  };
}
async function startFind() {
  if (!paid) return;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error(t("Camera access needs localhost or HTTPS.", "कैमरा एक्सेस के लिए localhost या HTTPS चाहिए।"));
    setStatus(t("Connecting to matching server…", "मैचिंग सर्वर से जुड़ रहे हैं…"));
    await connectSocket();
    closePeer();
    if (!localStream) { localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); showLocal(localStream); }
    send({ type: "find" }); activeCall = false; setCallButtons(false);
    $("findBtn").disabled = true;
    $("nextBtn").disabled = false;
  } catch (err) { alert(err.message || String(err)); setStatus(t("Could not start. Check camera permission and server.", "शुरू नहीं हो सका। कैमरा अनुमति और सर्वर चेक करें।")); }
}
function endCall(notify = true) {
  if (notify) send({ type: "leave" });
  closePeer(); activeCall = false; peerId = null;
  setCallButtons(false);
  if (paid) $("findBtn").disabled = false;
  if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
  $("localVideo").srcObject = null; $("localVideo").style.display = "none"; $("localPlaceholder").style.display = "flex";
  clearRemote();
  setStatus(t("Call ended. Find someone when you're ready.", "कॉल बंद हो गई। तैयार हों तो किसी से जुड़ें।"));
}
function getTransactions() {
  try { return JSON.parse(localStorage.getItem(transactionsKey) || "[]"); } catch { return []; }
}
function renderTransactions() {
  const rows = getTransactions();
  $("transactionRows").innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 5; td.className = "empty"; td.textContent = t("No demo transactions yet.", "अभी कोई डेमो ट्रांज़ैक्शन नहीं है।"); tr.appendChild(td); $("transactionRows").appendChild(tr); return;
  }
  rows.slice().reverse().forEach(row => {
    const tr = document.createElement("tr");
    [row.id, row.date, "₹" + row.amount].forEach(value => { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); });
    const status = document.createElement("td"); status.innerHTML = '<span class="status-tag">TEST SUCCESS</span>'; tr.appendChild(status);
    const mode = document.createElement("td"); mode.textContent = "SIMULATED"; tr.appendChild(mode);
    $("transactionRows").appendChild(tr);
  });
}
$("payBtn").addEventListener("click", () => {
  const id = "CL-TEST-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const rows = getTransactions();
  rows.push({ id, date: new Date().toLocaleString(), amount: 1000, status: "TEST SUCCESS", mode: "SIMULATED" });
  localStorage.setItem(transactionsKey, JSON.stringify(rows));
  localStorage.setItem("connectlive_demo_paid", "yes");
  paid = true; updateAccess(); renderTransactions();
  $("paymentStatus").textContent = t("Demo payment successful — no real money moved.", "डेमो पेमेंट सफल — असली पैसा ट्रांसफर नहीं हुआ।");
  $("payBtn").textContent = t("Test access unlocked", "टेस्ट एक्सेस चालू है");
});
$("findBtn").addEventListener("click", startFind);
$("nextBtn").addEventListener("click", async () => { endCall(true); await startFind(); });
$("endBtn").addEventListener("click", () => endCall(true));
$("muteBtn").addEventListener("click", () => {
  if (!localStream) return;
  muted = !muted; localStream.getAudioTracks().forEach(track => track.enabled = !muted);
  $("muteBtn").innerHTML = (muted ? "♬ " + t("Unmute", "माइक चालू") : "♬ " + t("Mute", "माइक बंद"));
});
$("reportBtn").addEventListener("click", () => {
  const category = prompt(t("Reason for report (e.g. harassment, nudity, spam):", "रिपोर्ट का कारण (जैसे उत्पीड़न, अश्लीलता, स्पैम):"), "inappropriate behavior");
  if (category !== null && category.trim()) { send({ type: "report", category }); setStatus(t("Report sent to prototype server.", "रिपोर्ट प्रोटोटाइप सर्वर को भेजी गई।")); }
});
$("blockBtn").addEventListener("click", () => { if (confirm(t("Block this person and end the call?", "इस व्यक्ति को ब्लॉक करके कॉल बंद करें?"))) { send({ type: "block" }); endCall(false); } });
$("exportBtn").addEventListener("click", () => {
  const rows = getTransactions(); const csv = [["Transaction ID","Date","Amount INR","Status","Mode"], ...rows.map(r => [r.id,r.date,r.amount,r.status,r.mode])].map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = "connectlive-demo-transactions.csv"; a.click(); URL.revokeObjectURL(a.href);
});
$("langBtn").addEventListener("click", () => {
  hindi = !hindi; document.documentElement.lang = hindi ? "hi" : "en";
  document.querySelectorAll("[data-en][data-hi]").forEach(el => { el.textContent = hindi ? el.dataset.hi : el.dataset.en; });
  $("langBtn").textContent = hindi ? "English" : "हिन्दी";
  updateAccess(); renderTransactions();
});
window.addEventListener("beforeunload", () => { if (ws) ws.close(); if (localStream) localStream.getTracks().forEach(t => t.stop()); });
updateAccess(); renderTransactions(); clearRemote();
$("localVideo").style.display = "none"; setCallButtons(false);
