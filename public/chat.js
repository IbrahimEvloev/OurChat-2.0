document.addEventListener("DOMContentLoaded", ()=>{
  const socket = io();
  const messages = document.getElementById("messages");
  const messagesWrapper = document.getElementById("messagesWrapper");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const micBtn = document.getElementById("micBtn");
  const composerBar = document.getElementById("composerBar");
  const recordingBar = document.getElementById("recordingBar");
  const recordTimer = document.getElementById("recordTimer");
  const cancelRecordBtn = document.getElementById("cancelRecordBtn");
  const sendRecordBtn = document.getElementById("sendRecordBtn");
  const chatTitle = document.getElementById("chatTitle");
  const chatStatus = document.getElementById("chatStatus");
  const chatAvatar = document.getElementById("chatAvatar");
  const backBtn = document.getElementById("backBtn");

  const newMsgBtn = document.getElementById("newMsgBtn");
  const newMsgBadge = document.getElementById("newMsgBadge");

  const replyPreview = document.getElementById("replyPreview");
  const replyPreviewName = document.getElementById("replyPreviewName");
  const replyPreviewText = document.getElementById("replyPreviewText");
  const replyPreviewClose = document.getElementById("replyPreviewClose");

  const editPreview = document.getElementById("editPreview");
  const editPreviewClose = document.getElementById("editPreviewClose");

  const msgMenu = document.getElementById("msgMenu");
  const msgMenuBackdrop = document.getElementById("msgMenuBackdrop");
  const msgMenuBox = document.getElementById("msgMenuBox");
  const menuCopy = document.getElementById("menuCopy");
  const menuEdit = document.getElementById("menuEdit");
  const menuDelete = document.getElementById("menuDelete");
  const globalDotsBtn = document.getElementById("globalDotsBtn");

  const currentUser = localStorage.getItem("currentUser");
  const currentChat = localStorage.getItem("currentChat");
  if(!currentUser || !currentChat){ window.location.href="chats.html"; return; }

  // ---------- Иконки галочек (в стиле WhatsApp) ----------
  const CHECK_SINGLE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7.5"/></svg>`;
  const CHECK_DOUBLE = `<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8.5l3 3 7-7.5"/><path d="M6.5 8.5l3 3 7-7.5"/></svg>`;
  const DOTS_ICON = `<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="16" cy="10" r="1.8"/></svg>`;
  const REPLY_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M4 12h10a5 5 0 0 1 5 5v1"/></svg>`;
  const PLAY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const PAUSE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;

  globalDotsBtn.innerHTML = DOTS_ICON;

  function avatarColor(str){
    let hash = 0;
    for (let i=0;i<str.length;i++){ hash = str.charCodeAt(i) + ((hash<<5)-hash); }
    return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
  }
  function avatarLabel(str){
    return str.slice(0, 2).toUpperCase();
  }
  function formatDuration(seconds){
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function isNearBottom(){
    return messagesWrapper.scrollHeight - messagesWrapper.scrollTop - messagesWrapper.clientHeight < 100;
  }

  function scrollToBottom(){
    messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
  }

  chatTitle.textContent = currentChat;
  chatAvatar.textContent = avatarLabel(currentChat);
  chatAvatar.style.backgroundColor = avatarColor(currentChat);

  let peerOnline = false;
  let typingTimeout = null;

  function renderPresence(){
    typingTimeout = null;
    chatStatus.textContent = peerOnline ? "в сети" : "не в сети";
    chatStatus.className = "text-xs " + (peerOnline ? "text-green-600" : "text-gray-400");
  }

  function showTyping(){
    chatStatus.textContent = "печатает...";
    chatStatus.className = "text-xs italic";
    chatStatus.style.color = "var(--mine)";
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(()=>{ chatStatus.style.color = ""; renderPresence(); }, 2000);
  }

  fetch(`/status?user=${encodeURIComponent(currentChat)}`)
    .then(res=>res.json())
    .then(data=>{ peerOnline = !!data.online; renderPresence(); })
    .catch(()=>{ renderPresence(); });

  backBtn.addEventListener("click", ()=>{
    window.location.href = "chats.html";
  });

  socket.emit("identify", { user: currentUser });
  socket.emit("join", { chat: currentChat, user: currentUser });

  // ---------- Прочитано ----------
  function markAsRead(){
    if(document.visibilityState === "visible"){
      socket.emit("read", { chat: currentChat, user: currentUser });
    }
  }
  document.addEventListener("visibilitychange", markAsRead);

  socket.on("history", msgs=>{
    messages.innerHTML="";
    msgs.forEach(msg=>addMessage(msg));
    scrollToBottom();
    markAsRead();
  });

  socket.on("message", msg=>{
    const isOwn = msg.from === currentUser;
    const wasNearBottom = isNearBottom();
    addMessage(msg);
    if(isOwn){
      scrollToBottom();
    } else {
      if(msg.from === currentChat) markAsRead();
      if(wasNearBottom){
        scrollToBottom();
      } else {
        bumpNewMsgBtn();
      }
    }
  });

  socket.on("message-deleted", ({id})=>{
    const el = messages.querySelector(`[data-msg-id="${id}"]`);
    if(el) el.remove();
  });

  socket.on("message-edited", ({id, text})=>{
    const wrapper = messages.querySelector(`[data-msg-id="${id}"]`);
    if(!wrapper) return;
    const textEl = wrapper.querySelector(".msg-text");
    const editedTag = wrapper.querySelector(".msg-edited-tag");
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
        statusEl.style.color = "var(--mine)";
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

  // ---------- Редактирование сообщения ----------
  let editingMessageId = null;

  function startEdit(msg){
    if(msg.from !== currentUser) return;
    cancelReply();
    editingMessageId = msg.id;
    input.value = msg.text;
    editPreview.classList.remove("hidden");
    editPreview.classList.add("flex");
    input.focus();
  }
  function cancelEdit(){
    editingMessageId = null;
    input.value = "";
    editPreview.classList.add("hidden");
    editPreview.classList.remove("flex");
  }
  editPreviewClose.addEventListener("click", cancelEdit);

  // ---------- Меню сообщения (нажатие и удержание) ----------
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
    clearSelectionOutsideHandler = (e)=>{
      if(e.target === globalDotsBtn || globalDotsBtn.contains(e.target)) return;
      if(msgMenu && !msgMenu.classList.contains("hidden")) return;
      clearSelection();
    };
    setTimeout(()=>{
      document.addEventListener("click", clearSelectionOutsideHandler, true);
      document.addEventListener("touchstart", clearSelectionOutsideHandler, true);
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
      const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
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
    if(activeMenuMessage) startEdit(activeMenuMessage);
    closeMessageMenu();
  });
  menuDelete.addEventListener("click", ()=>{
    if(activeMenuMessage && confirm("Удалить сообщение?")){
      socket.emit("delete-message", { chat: currentChat, user: currentUser, msgId: activeMenuMessage.id });
    }
    closeMessageMenu();
  });

  // ---------- Жесты: удержание на строке -> выделить сообщение, свайп вправо -> ответить ----------
  function attachGestures(row, bubble, replyIconEl, getMsg){
    let longPressTimer = null;
    let startX = 0, startY = 0;
    let dragging = false;
    let currentDx = 0;
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
      startX = x; startY = y;
      dragging = false;
      longPressTimer = setTimeout(()=> selectMessage(getMsg(), bubble), 450);
    }
    function onMove(x, y){
      const dx = x - startX;
      const dy = y - startY;
      if(!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)){
        dragging = true;
        clearTimeout(longPressTimer);
      } else if(!dragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)){
        clearTimeout(longPressTimer);
      }
      if(dragging){
        const clamped = Math.max(0, Math.min(MAX_DRAG, dx));
        setDx(clamped);
      }
    }
    function onUp(){
      clearTimeout(longPressTimer);
      if(dragging && currentDx >= THRESHOLD){
        startReply(getMsg());
      }
      if(dragging) snapBack();
      dragging = false;
    }

    row.addEventListener("touchstart", e=>{
      const t = e.touches[0];
      onDown(t.clientX, t.clientY);
    }, {passive:true});
    row.addEventListener("touchmove", e=>{
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, {passive:true});
    row.addEventListener("touchend", onUp);
    row.addEventListener("touchcancel", onUp);

    row.addEventListener("mousedown", e=> onDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", e=>{ if(longPressTimer || dragging) onMove(e.clientX, e.clientY); });
    window.addEventListener("mouseup", ()=>{ if(longPressTimer || dragging) onUp(); });
    row.addEventListener("contextmenu", e=> e.preventDefault());
  }

  function flashHighlight(el){
    el.style.boxShadow = "0 0 0 2px var(--mine)";
    setTimeout(()=> { el.style.boxShadow = ""; }, 1000);
  }

  function buildVoicePlayer(src, duration, isOwn){
    const wrap = document.createElement("div");
    wrap.className = "flex items-center gap-2 py-1";
    wrap.style.minWidth = "160px";

    const playBtn = document.createElement("button");
    playBtn.className = "w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center";
    playBtn.style.background = isOwn ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)";
    playBtn.style.color = isOwn ? "#fff" : "var(--mine)";
    playBtn.innerHTML = PLAY_ICON;

    const barWrap = document.createElement("div");
    barWrap.className = "flex-1 h-1 rounded-full overflow-hidden";
    barWrap.style.background = isOwn ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)";
    const bar = document.createElement("div");
    bar.style.height = "100%";
    bar.style.width = "0%";
    bar.style.background = isOwn ? "#fff" : "var(--mine)";
    barWrap.appendChild(bar);

    const timeLabel = document.createElement("span");
    timeLabel.className = "text-xs tabular-nums flex-shrink-0";
    timeLabel.style.opacity = "0.8";
    timeLabel.textContent = formatDuration(duration || 0);

    const audioEl = new Audio(src);

    playBtn.addEventListener("click", ()=>{
      if(audioEl.paused){
        document.querySelectorAll("audio").forEach(a=>{ if(a !== audioEl) a.pause(); });
        audioEl.play();
      } else {
        audioEl.pause();
      }
    });
    audioEl.addEventListener("play", ()=>{ playBtn.innerHTML = PAUSE_ICON; });
    audioEl.addEventListener("pause", ()=>{ playBtn.innerHTML = PLAY_ICON; });
    audioEl.addEventListener("ended", ()=>{ playBtn.innerHTML = PLAY_ICON; bar.style.width = "0%"; timeLabel.textContent = formatDuration(duration || 0); });
    audioEl.addEventListener("timeupdate", ()=>{
      if(audioEl.duration){
        bar.style.width = (audioEl.currentTime / audioEl.duration * 100) + "%";
        timeLabel.textContent = formatDuration(audioEl.currentTime);
      }
    });

    wrap.appendChild(playBtn);
    wrap.appendChild(barWrap);
    wrap.appendChild(timeLabel);
    return wrap;
  }

  // ---------- Рендер сообщения ----------
  function addMessage(msg){
    const {id, text, from, time, read, edited, replyTo, audio, duration} = msg;

    const row = document.createElement("div");
    row.className = "w-full flex " + (from===currentUser?"justify-end":"justify-start");
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
    bubble.className = `bubble relative px-3 py-2 text-sm shadow-sm select-none min-w-0 ${from===currentUser?'text-white rounded-2xl rounded-br-md':'bg-gray-200 text-gray-900 rounded-2xl rounded-bl-md'}`;
    if(from===currentUser) bubble.style.background = "#5C5C66";
    bubble.style.webkitTouchCallout = "none";

    if(replyTo){
      const replyDiv = document.createElement("div");
      replyDiv.className = "mb-1 pl-2 border-l-2 text-xs opacity-80 truncate cursor-pointer";
      replyDiv.style.borderColor = from===currentUser ? "rgba(255,255,255,0.5)" : "var(--theirs)";
      replyDiv.textContent = (replyTo.from === currentUser ? "Вы: " : "") + (replyTo.audio ? "🎤 Голосовое сообщение" : replyTo.text);
      replyDiv.addEventListener("click", (e)=>{
        e.stopPropagation();
        const target = messages.querySelector(`[data-msg-id="${replyTo.id}"]`);
        if(target){
          target.scrollIntoView({behavior:"smooth", block:"center"});
          flashHighlight(target.querySelector(".bubble"));
        }
      });
      bubble.appendChild(replyDiv);
    }

    if(audio){
      bubble.appendChild(buildVoicePlayer(audio, duration, from===currentUser));
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
    timeDiv.className ="text-[10px] opacity-70 mt-1 text-right flex items-center justify-end gap-1";

    const editedTag = document.createElement("span");
    editedTag.className = "msg-edited-tag italic" + (edited ? "" : " hidden");
    editedTag.textContent = "изменено";
    timeDiv.appendChild(editedTag);

    const timeText = document.createElement("span");
    timeText.textContent = time;
    timeDiv.appendChild(timeText);

    if(from === currentUser){
      const statusEl = document.createElement("span");
      statusEl.dataset.role = "status";
      statusEl.className = "flex items-center " + (read ? "opacity-100" : "opacity-60");
      if(read) statusEl.style.color = "var(--mine)";
      statusEl.innerHTML = read ? CHECK_DOUBLE : CHECK_SINGLE;
      timeDiv.appendChild(statusEl);
    }

    bubble.appendChild(timeDiv);
    wrapper.appendChild(bubble);
    row.appendChild(wrapper);
    messages.appendChild(row);

    attachGestures(row, bubble, replyIcon, () => msg);
  }

  function getTime(){
    const d = new Date();
    return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  }

  function buildOutgoingMessage(extra){
    return Object.assign({
      id: Date.now(),
      from: currentUser,
      time: getTime(),
      read: false,
      edited: false,
      replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, from: replyingTo.from, audio: replyingTo.audio } : null,
      text: "",
      audio: null,
      duration: null
    }, extra);
  }

  function sendMessage(){
    const text = input.value.trim();
    if(!text) return;

    if(editingMessageId){
      socket.emit("edit-message", { chat: currentChat, user: currentUser, msgId: editingMessageId, text });
      cancelEdit();
      return;
    }

    const msg = buildOutgoingMessage({ text });
    socket.emit("message", { chat: currentChat, user: currentUser, msg });
    input.value = "";
    cancelReply();
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", e=>{
    if(e.key === "Enter") sendMessage();
  });

  // ---------- Голосовые сообщения ----------
  let mediaRecorder = null;
  let mediaStream = null;
  let recordedChunks = [];
  let recordStartTime = null;
  let recordTimerInterval = null;

  function updateRecordTimer(){
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    recordTimer.textContent = formatDuration(elapsed);
  }

  function showRecordingBar(){
    composerBar.classList.add("hidden");
    composerBar.classList.remove("flex");
    recordingBar.classList.remove("hidden");
    recordingBar.classList.add("flex");
  }

  function hideRecordingBar(){
    clearInterval(recordTimerInterval);
    recordTimerInterval = null;
    if(mediaStream){
      mediaStream.getTracks().forEach(t=>t.stop());
      mediaStream = null;
    }
    recordingBar.classList.add("hidden");
    recordingBar.classList.remove("flex");
    composerBar.classList.remove("hidden");
    composerBar.classList.add("flex");
  }

  async function startRecording(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      alert("Микрофон не поддерживается этим браузером");
      return;
    }
    try{
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(err){
      alert("Не удалось получить доступ к микрофону");
      return;
    }
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = e=>{ if(e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.start();
    recordStartTime = Date.now();
    updateRecordTimer();
    recordTimerInterval = setInterval(updateRecordTimer, 1000);
    showRecordingBar();
  }

  function cancelRecording(){
    if(mediaRecorder && mediaRecorder.state !== "inactive"){
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    hideRecordingBar();
  }

  function sendRecording(){
    if(!mediaRecorder || mediaRecorder.state === "inactive"){
      hideRecordingBar();
      return;
    }
    const durationSeconds = Math.floor((Date.now() - recordStartTime) / 1000);
    mediaRecorder.onstop = ()=>{
      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = ()=>{
        const msg = buildOutgoingMessage({ audio: reader.result, duration: durationSeconds });
        socket.emit("message", { chat: currentChat, user: currentUser, msg });
        cancelReply();
      };
      reader.readAsDataURL(blob);
      hideRecordingBar();
    };
    mediaRecorder.stop();
  }

  micBtn.addEventListener("click", startRecording);
  cancelRecordBtn.addEventListener("click", cancelRecording);
  sendRecordBtn.addEventListener("click", sendRecording);
});
