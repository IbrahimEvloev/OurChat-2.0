document.addEventListener("DOMContentLoaded", ()=>{
const socket = io();
const $ = id => document.getElementById(id);
const messages = $("messages");
const messagesWrapper = $("messagesWrapper");
const input = $("input");
const sendBtn = $("sendBtn");
const micBtn = $("micBtn");
const composerBar = $("composerBar");
const recordingBar = $("recordingBar");
const recordTimer = $("recordTimer");
const cancelRecordBtn = $("cancelRecordBtn");
const sendRecordBtn = $("sendRecordBtn");
const chatTitle = $("chatTitle");
const chatStatus = $("chatStatus");
const chatAvatar = $("chatAvatar");
const backBtn = $("backBtn");
const newMsgBtn = $("newMsgBtn");
const newMsgBadge = $("newMsgBadge");
const replyPreview = $("replyPreview");
const replyPreviewName = $("replyPreviewName");
const replyPreviewText = $("replyPreviewText");
const replyPreviewClose = $("replyPreviewClose");
const editPreview = $("editPreview");
const editPreviewClose = $("editPreviewClose");
const msgMenu = $("msgMenu");
const msgMenuBackdrop = $("msgMenuBackdrop");
const msgMenuBox = $("msgMenuBox");
const menuCopy = $("menuCopy");
const menuEdit = $("menuEdit");
const menuDelete = $("menuDelete");
const globalDotsBtn = $("globalDotsBtn");

const currentUser = localStorage.getItem("currentUser");
const currentChat = localStorage.getItem("currentChat");
if(!currentUser || !currentChat){ window.location.href = "chats.html"; return; }

// ---------- Иконки ----------
const CHECK_SINGLE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7.5"/></svg>`;
const CHECK_DOUBLE = `<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8.5l3 3 7-7.5"/><path d="M6.5 8.5l3 3 7-7.5"/></svg>`;
const DOTS_ICON = `<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="16" cy="10" r="1.8"/></svg>`;
const REPLY_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M4 12h10a5 5 0 0 1 5 5v1"/></svg>`;
const PLAY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const PAUSE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
const READ_COLOR = "#DCEFFF";

globalDotsBtn.innerHTML = DOTS_ICON;

function avatarColor(str){
  let hash = 0;
  for(let i = 0; i < str.length; i++){ hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}
function avatarLabel(str){ return str.slice(0, 2).toUpperCase(); }

function isNearBottom(){
  return messagesWrapper.scrollHeight - messagesWrapper.scrollTop - messagesWrapper.clientHeight < 100;
}
function scrollToBottom(){ messagesWrapper.scrollTop = messagesWrapper.scrollHeight; }

chatTitle.textContent = currentChat;
chatAvatar.textContent = avatarLabel(currentChat);
chatAvatar.style.backgroundColor = avatarColor(currentChat);

let peerOnline = false;
let typingTimeout = null;

function renderPresence(){
  typingTimeout = null;
  chatStatus.textContent = peerOnline ? "в сети" : "не в сети";
  chatStatus.className = "text-xs " + (peerOnline ? "text-green-600" : "text-gray-400");
  chatStatus.style.color = "";
}

function showTyping(){
  chatStatus.textContent = "печатает...";
  chatStatus.className = "text-xs italic";
  chatStatus.style.color = "var(--mine)";
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(renderPresence, 2000);
}

fetch(`/status?user=${encodeURIComponent(currentChat)}`)
  .then(res => res.json())
  .then(data => { peerOnline = !!data.online; renderPresence(); })
  .catch(() => { renderPresence(); });

backBtn.addEventListener("click", ()=>{ window.location.href = "chats.html"; });

socket.emit("identify", { user: currentUser });
socket.emit("join", { chat: currentChat, user: currentUser });
socket.on("connect", ()=>{
  socket.emit("identify", { user: currentUser });
  socket.emit("join", { chat: currentChat, user: currentUser });
});

// ---------- Прочитано ----------
function markAsRead(){
  if(document.visibilityState === "visible"){
    socket.emit("read", { chat: currentChat, user: currentUser });
  }
}
document.addEventListener("visibilitychange", markAsRead);

socket.on("history", msgs=>{
  messages.innerHTML = "";
  lastFrom = null; lastDay = null; lastBubble = null;
  msgs.forEach(msg => addMessage(msg, false));
  scrollToBottom();
  hideNewMsgBtn();
  markAsRead();
});

socket.on("message", msg=>{
  addMessage(msg);
  if(msg.from === currentChat) markAsRead();
});

socket.on("message-deleted", ({id})=>{
  const el = messages.querySelector(`[data-msg-id="${id}"]`);
  if(el) el.remove();
});

socket.on("message-edited", ({id, text})=>{
  const row = messages.querySelector(`[data-msg-id="${id}"]`);
  if(!row) return;
  const textEl = row.querySelector(".msg-text");
  const editedTag = row.querySelector(".msg-edited-tag");
  if(textEl) textEl.textContent = text;
  if(editedTag) editedTag.classList.remove("hidden");
});

socket.on("messages-read", ({reader, ids})=>{
  if(reader !== currentChat) return;
  ids.forEach(id=>{
    const statusEl = messages.querySelector(`[data-msg-id="${id}"] [data-role="status"]`);
    if(statusEl){
      statusEl.innerHTML = CHECK_DOUBLE;
      statusEl.classList.remove("opacity-60");
      statusEl.classList.add("opacity-100");
      statusEl.style.color = READ_COLOR;
    }
  });
});

socket.on("presence", ({user, online})=>{
  if(user === currentChat){
    peerOnline = online;
    if(!typingTimeout) renderPresence();
  }
});

socket.on("typing", ({from})=>{
  if(from === currentChat) showTyping();
});

let typingEmitCooldown = null;
input.addEventListener("input", ()=>{
  if(typingEmitCooldown) return;
  socket.emit("typing", { chat: currentChat, user: currentUser });
  typingEmitCooldown = setTimeout(()=>{ typingEmitCooldown = null; }, 1500);
});

// ---------- Кнопка "новое сообщение" ----------
let unreadFromPeer = 0;

function showNewMsgBtn(){
  newMsgBtn.classList.remove("hidden");
  newMsgBtn.classList.add("flex");
}
function hideNewMsgBtn(){
  newMsgBtn.classList.add("hidden");
  newMsgBtn.classList.remove("flex");
  unreadFromPeer = 0;
  newMsgBadge.classList.add("hidden");
  newMsgBadge.textContent = "0";
}
function bumpNewMsgBtn(){
  unreadFromPeer++;
  newMsgBadge.textContent = unreadFromPeer > 9 ? "9+" : String(unreadFromPeer);
  newMsgBadge.classList.remove("hidden");
  showNewMsgBtn();
}

newMsgBtn.addEventListener("click", ()=>{
  scrollToBottom();
  hideNewMsgBtn();
  markAsRead();
});

messagesWrapper.addEventListener("scroll", ()=>{
  if(isNearBottom()) hideNewMsgBtn();
});

// ---------- Ответ на сообщение ----------
let replyingTo = null;

function startReply(msg){
  cancelEdit();
  replyingTo = { id: msg.id, text: msg.text, from: msg.from, audio: !!msg.audio };
  replyPreviewName.textContent = msg.from === currentUser ? "Вы" : currentChat;
  replyPreviewText.textContent = msg.audio ? "🎤 Голосовое сообщение" : msg.text;
  replyPreview.classList.remove("hidden");
  replyPreview.classList.add("flex");
  input.focus();
}
function cancelReply(){
  replyingTo = null;
  replyPreview.classList.add("hidden");
  replyPreview.classList.remove("flex");
}
replyPreviewClose.addEventListener("click", cancelReply);

// ---------- Редактирование ----------
let editingMessageId = null;

function startEdit(msg){
  if(msg.from !== currentUser || msg.audio) return;
  cancelReply();
  editingMessageId = msg.id;
  input.value = msg.text;
  editPreview.classList.remove("hidden");
  editPreview.classList.add("flex");
  input.focus();
}
function cancelEdit(){
  if(editingMessageId !== null) input.value = "";
  editingMessageId = null;
  editPreview.classList.add("hidden");
  editPreview.classList.remove("flex");
}
editPreviewClose.addEventListener("click", cancelEdit);

// ---------- Меню сообщения ----------
let activeMenuMessage = null;
let selectedBubble = null;
let clearSelectionOutsideHandler = null;

function selectMessage(msg, bubbleEl){
  clearSelection();
  selectedBubble = bubbleEl;
  bubbleEl.style.boxShadow = "0 0 0 2px var(--mine)";
  globalDotsBtn.style.opacity = "1";
  globalDotsBtn.style.pointerEvents = "auto";
  globalDotsBtn.onclick = ()=>{
    const rect = globalDotsBtn.getBoundingClientRect();
    openMessageMenu(msg, rect.right, rect.bottom + 6);
  };
  const handler = (e)=>{
    if(e.target === globalDotsBtn || globalDotsBtn.contains(e.target)) return;
    if(selectedBubble && selectedBubble.contains(e.target)) return; // click после долгого нажатия
    if(!msgMenu.classList.contains("hidden")) return;
    clearSelection();
  };
  clearSelectionOutsideHandler = handler;
  setTimeout(()=>{
    if(clearSelectionOutsideHandler !== handler) return;
    document.addEventListener("click", handler, true);
    document.addEventListener("touchstart", handler, true);
  }, 50);
}

function clearSelection(){
  if(selectedBubble){ selectedBubble.style.boxShadow = ""; selectedBubble = null; }
  globalDotsBtn.style.opacity = "0";
  globalDotsBtn.style.pointerEvents = "none";
  globalDotsBtn.onclick = null;
  if(clearSelectionOutsideHandler){
    document.removeEventListener("click", clearSelectionOutsideHandler, true);
    document.removeEventListener("touchstart", clearSelectionOutsideHandler, true);
    clearSelectionOutsideHandler = null;
  }
}

function openMessageMenu(msg, x, y){
  activeMenuMessage = msg;
  const isOwn = msg.from === currentUser;
  menuEdit.classList.toggle("hidden", !isOwn || !!msg.audio);
  menuCopy.classList.toggle("hidden", !!msg.audio);
  menuDelete.classList.toggle("hidden", !isOwn);
  msgMenu.classList.remove("hidden");
  requestAnimationFrame(()=>{
    const rect = msgMenuBox.getBoundingClientRect();
    const left = Math.max(8, Math.min(x - rect.width, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    msgMenuBox.style.left = left + "px";
    msgMenuBox.style.top = top + "px";
  });
}
function closeMessageMenu(){
  msgMenu.classList.add("hidden");
  activeMenuMessage = null;
  clearSelection();
}

msgMenuBackdrop.addEventListener("click", closeMessageMenu);
menuCopy.addEventListener("click", ()=>{
  if(activeMenuMessage){
    const text = activeMenuMessage.text;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).catch(()=>{});
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand("copy"); }catch(e){}
      document.body.removeChild(ta);
    }
  }
  closeMessageMenu();
});
menuEdit.addEventListener("click", ()=>{
  const m = activeMenuMessage;
  closeMessageMenu();
  if(m) startEdit(m);
});
menuDelete.addEventListener("click", ()=>{
  const m = activeMenuMessage;
  if(m && confirm("Удалить сообщение?")){
    socket.emit("delete-message", { chat: currentChat, user: currentUser, msgId: m.id });
  }
  closeMessageMenu();
});

// ---------- Жесты ----------
function attachGestures(row, bubble, replyIconEl, getMsg){
  let longPressTimer = null;
  let startX = 0, startY = 0;
  let pressed = false, dragging = false, currentDx = 0;
  const THRESHOLD = 56;
  const MAX_DRAG = 72;

  function setDx(dx){
    currentDx = dx;
    bubble.style.transform = dx ? `translateX(${dx}px)` : "";
    const progress = Math.min(1, dx / THRESHOLD);
    replyIconEl.style.opacity = progress;
    replyIconEl.style.transform = `translateY(-50%) scale(${0.6 + progress * 0.4})`;
  }

  function snapBack(){
    bubble.style.transition = "transform 0.2s ease";
    replyIconEl.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setDx(0);
    setTimeout(()=>{ bubble.style.transition = ""; replyIconEl.style.transition = ""; }, 200);
  }

  function onDown(x, y){
    pressed = true; dragging = false;
    startX = x; startY = y;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(()=>{
      longPressTimer = null;
      if(pressed && !dragging) selectMessage(getMsg(), bubble);
    }, 450);
  }
  function onMove(x, y){
    if(!pressed) return;
    const dx = x - startX, dy = y - startY;
    if(!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)){
      dragging = true;
      clearTimeout(longPressTimer); longPressTimer = null;
    } else if(!dragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)){
      clearTimeout(longPressTimer); longPressTimer = null;
    }
    if(dragging) setDx(Math.max(0, Math.min(MAX_DRAG, dx)));
  }
  function onUp(){
    if(!pressed) return;
    pressed = false;
    clearTimeout(longPressTimer); longPressTimer = null;
    if(dragging){
      if(currentDx >= THRESHOLD) startReply(getMsg());
      snapBack();
    }
    dragging = false;
  }

  row.addEventListener("touchstart", e=>{ const t = e.touches[0]; onDown(t.clientX, t.clientY); }, {passive:true});
  row.addEventListener("touchmove", e=>{ const t = e.touches[0]; onMove(t.clientX, t.clientY); }, {passive:true});
  row.addEventListener("touchend", onUp);
  row.addEventListener("touchcancel", onUp);

  const mouseMove = e => onMove(e.clientX, e.clientY);
  const mouseUp = ()=>{
    window.removeEventListener("mousemove", mouseMove);
    window.removeEventListener("mouseup", mouseUp);
    onUp();
  };
  row.addEventListener("mousedown", e=>{
    if(e.button !== 0) return;
    onDown(e.clientX, e.clientY);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
  });
  row.addEventListener("contextmenu", e=> e.preventDefault());
}

function flashHighlight(el){
  if(!el) return;
  el.style.boxShadow = "0 0 0 2px var(--mine)";
  setTimeout(()=>{ el.style.boxShadow = ""; }, 1000);
}

// ---------- Голосовой плеер ----------
let currentAudio = null;

function buildVoicePlayer(src, duration, isOwn){
  const wrap = document.createElement("div");
  wrap.className = "flex items-center gap-2 py-1";
  wrap.style.minWidth = "160px";

  const playBtn = document.createElement("button");
  playBtn.className = "w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center";
  playBtn.style.background = isOwn ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)";
  playBtn.style.color = isOwn ? "#fff" : "var(--mine)";
  playBtn.innerHTML = PLAY_ICON;

  const BAR_COUNT = 28;
  const barWrap = document.createElement("div");
  barWrap.className = "flex-1 flex items-center h-6";
  barWrap.style.gap = "2px";
  let seed = (duration || 1) * 9301 + src.length;
  const bars = [];
  for(let i = 0; i < BAR_COUNT; i++){
    seed = (seed * 9301 + 49297) % 233280;
    const h = 20 + (seed / 233280) * 80;
    const b = document.createElement("div");
    b.style.width = "3px";
    b.style.height = h + "%";
    b.style.borderRadius = "2px";
    b.style.background = "currentColor";
    b.style.opacity = "0.35";
    barWrap.appendChild(b);
    bars.push(b);
  }
  function paintBars(p){
    const filled = Math.round(p * BAR_COUNT);
    bars.forEach((b, i)=>{ b.style.opacity = i < filled ? "1" : "0.35"; });
  }

  const timeLabel = document.createElement("span");
  timeLabel.className = "text-xs tabular-nums flex-shrink-0";
  timeLabel.style.opacity = "0.8";
  timeLabel.textContent = formatDuration(duration || 0);

  const audioEl = new Audio(src);
  playBtn.addEventListener("click", ()=>{
    if(audioEl.paused){
      if(currentAudio && currentAudio !== audioEl) currentAudio.pause();
      currentAudio = audioEl;
      audioEl.play().catch(()=>{});
    } else {
      audioEl.pause();
    }
  });
  audioEl.addEventListener("play", ()=>{ playBtn.innerHTML = PAUSE_ICON; });
  audioEl.addEventListener("pause", ()=>{ playBtn.innerHTML = PLAY_ICON; });
  audioEl.addEventListener("ended", ()=>{
    playBtn.innerHTML = PLAY_ICON;
    paintBars(0);
    timeLabel.textContent = formatDuration(duration || 0);
  });
  audioEl.addEventListener("timeupdate", ()=>{
    const total = isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : (duration || 0);
    if(total){
      paintBars(audioEl.currentTime / total);
      timeLabel.textContent = formatDuration(audioEl.currentTime);
    }
  });

  wrap.appendChild(playBtn);
  wrap.appendChild(barWrap);
  wrap.appendChild(timeLabel);
  return wrap;
}

// ---------- Группировка и даты ----------
let lastFrom = null, lastDay = null, lastBubble = null;

function dayKey(ts){
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ts){
  const d = new Date(ts);
  const now = new Date();
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  if(dayKey(ts) === dayKey(now.getTime())) return "Сегодня";
  if(dayKey(ts) === dayKey(yest.getTime())) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
function setTail(bubbleEl, isOwn, on){
  const tail = isOwn ? "rounded-br-md" : "rounded-bl-md";
  bubbleEl.classList.toggle(tail, on);
  bubbleEl.classList.add("rounded-2xl");
}

// ---------- Рендер сообщения ----------
function addMessage(msg, animate = true){
  const {id, text, from, time, read, edited, replyTo, audio, duration} = msg;
  const ts = Number(id) || Date.now();
  const key = dayKey(ts);
  const isOwn = from === currentUser;

  if(key !== lastDay){
    const chip = document.createElement("div");
    chip.className = "flex justify-center my-1";
    const span = document.createElement("span");
    span.className = "text-[11px] text-gray-500 bg-gray-100 px-3 py-1 rounded-full";
    span.textContent = dayLabel(ts);
    chip.appendChild(span);
    messages.appendChild(chip);
    lastDay = key; lastFrom = null; lastBubble = null;
  }

  const row = document.createElement("div");
  row.className = "w-full flex " + (isOwn ? "justify-end" : "justify-start");
  if(animate) row.classList.add("msg-in");
  const grouped = lastFrom === from;
  if(grouped) row.style.marginTop = "-4px";
  row.dataset.msgId = id;
  row.style.touchAction = "pan-y";

  const wrapper = document.createElement("div");
  wrapper.className = "relative flex max-w-[75%] min-w-0";

  const replyIcon = document.createElement("div");
  replyIcon.className = "absolute top-1/2 flex items-center justify-center rounded-full pointer-events-none";
  replyIcon.style.left = "-30px";
  replyIcon.style.width = "26px";
  replyIcon.style.height = "26px";
  replyIcon.style.background = "#E7E5EA";
  replyIcon.style.color = "var(--mine)";
  replyIcon.style.opacity = "0";
  replyIcon.style.transform = "translateY(-50%) scale(0.6)";
  replyIcon.innerHTML = REPLY_ICON;
  wrapper.appendChild(replyIcon);

  const bubble = document.createElement("div");
  bubble.className = `bubble relative px-3 py-2 text-sm shadow-sm select-none min-w-0 ${isOwn ? "text-white rounded-2xl rounded-br-md" : "bg-gray-200 text-gray-900 rounded-2xl rounded-bl-md"}`;
  if(isOwn) bubble.style.background = "#5C5C66";
  bubble.style.webkitTouchCallout = "none";

  if(replyTo){
    const replyDiv = document.createElement("div");
    replyDiv.className = "mb-1 pl-2 border-l-2 text-xs opacity-80 truncate cursor-pointer";
    replyDiv.style.borderColor = isOwn ? "rgba(255,255,255,0.5)" : "var(--theirs)";
    replyDiv.textContent = (replyTo.from === currentUser ? "Вы: " : "") + (replyTo.audio ? "🎤 Голосовое сообщение" : replyTo.text);
    replyDiv.addEventListener("click", (e)=>{
      e.stopPropagation();
      const target = messages.querySelector(`[data-msg-id="${replyTo.id}"]`);
      if(target){
        target.scrollIntoView({behavior: "smooth", block: "center"});
        flashHighlight(target.querySelector(".bubble"));
      }
    });
    bubble.appendChild(replyDiv);
  }

  if(audio){
    bubble.appendChild(buildVoicePlayer(audio, duration, isOwn));
  } else {
    const textDiv = document.createElement("div");
    textDiv.className = "msg-text";
    textDiv.style.overflowWrap = "anywhere";
    textDiv.style.wordBreak = "break-word";
    textDiv.style.whiteSpace = "pre-wrap";
    textDiv.textContent = text;
    bubble.appendChild(textDiv);
  }

  const timeDiv = document.createElement("div");
  timeDiv.className = "text-[10px] opacity-70 mt-1 text-right flex items-center justify-end gap-1";

  const editedTag = document.createElement("span");
  editedTag.className = "msg-edited-tag italic" + (edited ? "" : " hidden");
  editedTag.textContent = "изменено";
  timeDiv.appendChild(editedTag);

  const timeText = document.createElement("span");
  timeText.textContent = time;
  timeDiv.appendChild(timeText);

  if(isOwn){
    const statusSpan = document.createElement("span");
    statusSpan.dataset.role = "status";
    statusSpan.className = "inline-flex items-center " + (read ? "opacity-100" : "opacity-60");
    statusSpan.innerHTML = read ? CHECK_DOUBLE : CHECK_SINGLE;
    if(read) statusSpan.style.color = READ_COLOR;
    timeDiv.appendChild(statusSpan);
  }

  bubble.appendChild(timeDiv);
  wrapper.appendChild(bubble);
  row.appendChild(wrapper);

  attachGestures(row, bubble, replyIcon, ()=>({
    id, from,
    text: bubble.querySelector(".msg-text") ? bubble.querySelector(".msg-text").textContent : "",
    audio: !!audio
  }));

  if(grouped && lastBubble){
    setTail(lastBubble.el, lastBubble.own, false);
  }
  lastFrom = from;
  lastBubble = { el: bubble, own: isOwn };

  const wasNearBottom = isNearBottom();
  messages.appendChild(row);

  if(!animate) return; // история: скролл и счётчик обрабатываются в "history"
  if(isOwn){ scrollToBottom(); hideNewMsgBtn(); }
  else if(wasNearBottom){ scrollToBottom(); }
  else { bumpNewMsgBtn(); }
}

function getTime(){
  return new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
}

// ---------- Запись голосовых ----------
let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = 0;
let recordTimerInterval = null;
let recordingCancelled = false;

function formatDuration(sec){
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function showRecordingUI(){
  composerBar.classList.add("hidden");
  composerBar.classList.remove("flex");
  recordingBar.classList.remove("hidden");
  recordingBar.classList.add("flex");
}
function hideRecordingUI(){
  recordingBar.classList.add("hidden");
  recordingBar.classList.remove("flex");
  composerBar.classList.remove("hidden");
  composerBar.classList.add("flex");
  clearInterval(recordTimerInterval);
  recordTimer.textContent = "0:00";
}

async function startRecording(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingCancelled = false;
    audioChunks = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorder = recorder;
    recorder.ondataavailable = e=>{ if(e.data.size > 0) audioChunks.push(e.data); };
    recorder.onstop = ()=>{
      stream.getTracks().forEach(t => t.stop());
      if(recordingCancelled) return;
      const duration = Math.round((Date.now() - recordStartTime) / 1000);
      const blob = new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" });
      const reader = new FileReader();
      reader.onload = ()=>{ sendVoiceMessage(reader.result, duration); };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    recordStartTime = Date.now();
    showRecordingUI();
    recordTimerInterval = setInterval(()=>{
      recordTimer.textContent = formatDuration((Date.now() - recordStartTime) / 1000);
    }, 250);
  } catch(err){
    alert("Не удалось получить доступ к микрофону");
  }
}

function stopRecording(cancel){
  recordingCancelled = !!cancel;
  if(mediaRecorder && mediaRecorder.state !== "inactive"){
    mediaRecorder.stop();
  }
  hideRecordingUI();
}

function sendVoiceMessage(dataUrl, duration){
  const msg = {
    id: Date.now(), text: "", audio: dataUrl, duration,
    from: currentUser, time: getTime(), read: false, edited: false,
    replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, from: replyingTo.from, audio: replyingTo.audio } : null
  };
  socket.emit("message", { chat: currentChat, user: currentUser, msg });
  cancelReply();
}

micBtn.addEventListener("click", ()=>{
  if(input.value.trim()){ sendMessage(); return; }
  startRecording();
});
sendRecordBtn.addEventListener("click", ()=> stopRecording(false));
cancelRecordBtn.addEventListener("click", ()=> stopRecording(true));

function sendMessage(){
  const text = input.value.trim();
  if(!text) return;

  if(editingMessageId !== null){
    socket.emit("edit-message", { chat: currentChat, user: currentUser, msgId: editingMessageId, text });
    cancelEdit();
    return;
  }

  const msg = {
    id: Date.now(), text,
    from: currentUser, time: getTime(), read: false, edited: false,
    replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, from: replyingTo.from, audio: replyingTo.audio } : null
  };
  socket.emit("message", { chat: currentChat, user: currentUser, msg });
  input.value = "";
  cancelReply();
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e=>{
  if(e.key === "Enter" && !e.isComposing) sendMessage();
});
});
