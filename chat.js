document.addEventListener("DOMContentLoaded", ()=>{
  const socket = io();
  const messages = document.getElementById("messages");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const chatTitle = document.getElementById("chatTitle");
  const backBtn = document.getElementById("backBtn");

  const currentUser = localStorage.getItem("currentUser");
  const currentChat = localStorage.getItem("currentChat");
  if(!currentUser || !currentChat){ window.location.href="chats.html"; return; }

  chatTitle.textContent = currentChat;

  backBtn.addEventListener("click", ()=>{
    window.location.href = "chats.html";
  });

  socket.emit("join", { chat: currentChat, user: currentUser });

  socket.on("history", msgs=>{
    messages.innerHTML="";
    msgs.forEach(msg=>addMessage(msg));
  });

  socket.on("message", msg=>addMessage(msg));

  function addMessage({text, from, time}){
    const wrapper = document.createElement("div");
    wrapper.className = "flex max-w-[75%] " + (from===currentUser?"ml-auto":"mr-auto");

    const bubble = document.createElement("div");
    bubble.className = `px-3 py-2 rounded-2xl text-sm shadow-sm ${from===currentUser?'bg-blue-500 text-white':'bg-gray-200 text-gray-900'}`;

    const textDiv = document.createElement("div");
    textDiv.textContent = text; // textContent вместо innerHTML — защита от XSS

    const timeDiv = document.createElement("div");
    timeDiv.className = "text-[10px] opacity-70 mt-1 text-right";
    timeDiv.textContent = time;

    bubble.appendChild(textDiv);
    bubble.appendChild(timeDiv);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
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
