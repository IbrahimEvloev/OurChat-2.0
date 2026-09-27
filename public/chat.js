document.addEventListener("DOMContentLoaded", ()=>{
  const socket = io();
  const messages = document.getElementById("messages");
  const messagesWrapper = document.getElementById("messagesWrapper");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
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
  const menuReply = document.getElementById("menuReply");
  const menuEdit = document.getElementById("menuEdit");
  const menuDelete = document.getElementById("menuDelete");

  const currentUser = localStorage.getItem("currentUser");
  const currentChat = localStorage.getItem("currentChat");
  if(!currentUser || !currentChat){ window.location.href="chats.html"; return; }

  // ---------- Иконки галочек (в стиле WhatsApp) ----------
  const CHECK_SINGLE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7.5"/></svg>`;
  const CHECK_DOUBLE = `<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8.5l3 3 7-7.5"/><path d="M6.5 8.5l3 3 7-7.5"/></svg>`;

  function avatarColor(str){
    let hash = 0;
    for (let i=0;i<str.length;i++){ hash = str.charCodeAt(i) + ((hash<<5)-hash); }
    return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
  }
  function avatarLabel(str){
    return str.slice(0, 2).toUpperCase();
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
    addMessage(msg);
    if(msg.from === currentChat) markAsRead();
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
    replyingTo = { id: msg.id, text: msg.text, from: msg.from };
    replyPreviewName.textContent = msg.from === currentUser ? "Вы" : currentChat;
    replyPreviewText.textContent = msg.text;
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

  function openMessageMenu(msg, x, y){
    activeMenuMessage = msg;
    const isOwn = msg.from === currentUser;
    menuEdit.classList.toggle("hidden", !isOwn);
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
  }

  msgMenuBackdrop.addEventListener("click", closeMessageMenu);
  menuReply.addEventListener("click", ()=>{
    if(activeMenuMessage) startReply(activeMenuMessage);
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

  function attachLongPress(el, getMsg){
    let timer = null;
    let startX = 0, startY = 0;

    const start = (x, y) => {
      startX = x; startY = y;
      timer = setTimeout(()=> openMessageMenu(getMsg(), x, y), 450);
    };
    const cancel = () => clearTimeout(timer);
    const move = (x, y) => {
      if(Math.abs(x - startX) > 10 || Math.abs(y - startY) > 10) cancel();
    };

    el.addEventListener("touchstart", e=>{
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    }, {passive:true});
    el.addEventListener("touchmove", e=>{
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    }, {passive:true});
    el.addEventListener("touchend", cancel);
    el.addEventListener("touchcancel", cancel);

    el.addEventListener("mousedown", e=> start(e.clientX, e.clientY));
    el.addEventListener("mouseup", cancel);
    el.addEventListener("mouseleave", cancel);
    el.addEventListener("contextmenu", e=> e.preventDefault());
  }

  function flashHighlight(el){
    el.style.boxShadow = "0 0 0 2px var(--mine)";
    setTimeout(()=> { el.style.boxShadow = ""; }, 1000);
  }

  // ---------- Рендер сообщения ----------
  function addMessage(msg){
    const {id, text, from, time, read, edited, replyTo} = msg;

    const wrapper = document.createElement("div");
    wrapper.className = "flex max-w-[75%] min-w-0 " + (from===currentUser?"ml-auto":"mr-auto");
    wrapper.dataset.msgId = id;

    const bubble = document.createElement("div");
    bubble.className = `relative px-3 py-2 text-sm shadow-sm select-none min-w-0 ${from===currentUser?'text-white rounded-2xl rounded-br-md':'bg-gray-200 text-gray-900 rounded-2xl rounded-bl-md'}`;
    if(from===currentUser) bubble.style.background = "#5C5C66";
    bubble.style.webkitTouchCallout = "none";

    if(replyTo){
      const replyDiv = document.createElement("div");
      replyDiv.className = "mb-1 pl-2 border-l-2 text-xs opacity-80 truncate cursor-pointer";
      replyDiv.style.borderColor = from===currentUser ? "rgba(255,255,255,0.5)" : "var(--theirs)";
      replyDiv.textContent = (replyTo.from === currentUser ? "Вы: " : "") + replyTo.text;
      replyDiv.addEventListener("click", (e)=>{
        e.stopPropagation();
        const target = messages.querySelector(`[data-msg-id="${replyTo.id}"]`);
        if(target){
          target.scrollIntoView({behavior:"smooth", block:"center"});
          flashHighlight(target.firstChild);
        }
      });
      bubble.appendChild(replyDiv);
    }

    const textDiv = document.createElement("div");
    textDiv.className = "msg-text";
    textDiv.style.overflowWrap = "anywhere";
    textDiv.style.wordBreak = "break-word";
    textDiv.style.whiteSpace = "pre-wrap";
    textDiv.textContent = text;
    bubble.appendChild(textDiv);

    const timeDiv = document.createElement("div");
    timeDiv.className = "text-[10px] opacity-70 mt-1 text-right flex items-center justify-end gap-1";

    const editedTag = document.createElement("span");
    editedTag.className = "msg-edited-tag italic" + (edited ? "" : " hidden");
    editedTag.textContent = "изменено";
    timeDiv.appendChild(editedTag);

    const timeText = document.createElement("span");
    timeText.textContent = time;
    timeDiv.appendChild(timeText);

    if(from === currentUser){
      const statusSpan = document.createElement("span");
      statusSpan.dataset.role = "status";
      statusSpan.className = "inline-flex items-center " + (read ? "opacity-100" : "opacity-60");
      statusSpan.innerHTML = read ? CHECK_DOUBLE : CHECK_SINGLE;
      if(read) statusSpan.style.color = "#DCEFFF";
      timeDiv.appendChild(statusSpan);
    }

    bubble.appendChild(timeDiv);
    wrapper.appendChild(bubble);

    attachLongPress(bubble, ()=>({
      id,
      from,
      text: bubble.querySelector(".msg-text").textContent
    }));

    const wasNearBottom = isNearBottom();
    messages.appendChild(wrapper);

    if(from === currentUser){
      scrollToBottom();
      hideNewMsgBtn();
    } else if(wasNearBottom){
      scrollToBottom();
    } else {
      bumpNewMsgBtn();
    }
  }

  function getTime(){
    const d = new Date();
    return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  }

  function sendMessage(){
    const text = input.value.trim();
    if(!text) return;

    if(editingMessageId){
      socket.emit("edit-message", { chat: currentChat, user: currentUser, msgId: editingMessageId, text });
      cancelEdit();
      return;
    }

    const msg = {
      id: Date.now(),
      text,
      from: currentUser,
      time: getTime(),
      read: false,
      edited: false,
      replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, from: replyingTo.from } : null
    };
    socket.emit("message", { chat: currentChat, user: currentUser, msg });
    input.value = "";
    cancelReply();
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", e=>{
    if(e.key==="Enter") sendMessage();
  });
});
