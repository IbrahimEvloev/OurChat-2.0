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

  const currentUser = localStorage.getItem("currentUser");
  const currentChat = localStorage.getItem("currentChat");
  if(!currentUser || !currentChat){ window.location.href="chats.html"; return; }

  function avatarColor(str){
    let hash = 0;
    for (let i=0;i<str.length;i++){ hash = str.charCodeAt(i) + ((hash<<5)-hash); }
    return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
  }
  function avatarLabel(str){
    const digits = str.replace(/\D/g,'');
    return digits.slice(-2) || '?';
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
    chatStatus.className = "text-xs text-blue-500 italic";
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(renderPresence, 2000);
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

  socket.on("history", msgs=>{
    messages.innerHTML="";
    msgs.forEach(msg=>addMessage(msg));
    scrollToBottom();
  });

  socket.on("message", msg=>addMessage(msg));

  socket.on("message-deleted", ({id})=>{
    const el = messages.querySelector(`[data-msg-id="${id}"]`);
    if(el) el.remove();
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

  function addMessage({id, text, from, time}){
    const wrapper = document.createElement("div");
    wrapper.className = "flex max-w-[75%] " + (from===currentUser?"ml-auto":"mr-auto");
    wrapper.dataset.msgId = id;

    const bubble = document.createElement("div");
    bubble.className = `relative px-3 py-2 rounded-2xl text-sm shadow-sm ${from===currentUser?'bg-blue-500 text-white':'bg-gray-200 text-gray-900'}`;

    const textDiv = document.createElement("div");
    textDiv.textContent = text;

    const timeDiv = document.createElement("div");
    timeDiv.className = "text-[10px] opacity-70 mt-1 text-right";
    timeDiv.textContent = time;

    bubble.appendChild(textDiv);
    bubble.appendChild(timeDiv);

    if(from === currentUser){
      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.className = "absolute -left-5 top-1 text-gray-400 hover:text-red-500 text-xs";
      delBtn.addEventListener("click", ()=>{
        if(confirm("Удалить сообщение?")){
          socket.emit("delete-message", { chat: currentChat, user: currentUser, msgId: id });
        }
      });
      bubble.appendChild(delBtn);
    }

    const wasNearBottom = isNearBottom();
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);

    if(from === currentUser || wasNearBottom){
      scrollToBottom();
    }
  }

  function getTime(){
    const d = new Date();
    return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  }

  function sendMessage(){
    const text = input.value.trim();
    if(!text) return;
    const msg = {id:Date.now(), text, from:currentUser, time:getTime()};
    socket.emit("message", { chat: currentChat, user: currentUser, msg });
    input.value="";
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", e=>{
    if(e.key==="Enter") sendMessage();
  });
});
