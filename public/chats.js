document.addEventListener("DOMContentLoaded", ()=>{
  const chatList = document.getElementById("chatList");
  const logoutBtn = document.getElementById("logoutBtn");
  const searchInput = document.getElementById("searchInput");
  const searchResult = document.getElementById("searchResult");

  const logoutModal = document.getElementById("logoutModal");
  const confirmLogout = document.getElementById("confirmLogout");
  const cancelLogout = document.getElementById("cancelLogout");

  const currentUser = localStorage.getItem("currentUser");
  if(!currentUser){ window.location.href="index.html"; return; }

  function avatarColor(str){
    let hash = 0;
    for (let i=0;i<str.length;i++){ hash = str.charCodeAt(i) + ((hash<<5)-hash); }
    return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
  }
  function avatarLabel(str){
    return str.slice(0, 2).toUpperCase();
  }

  function openChat(username){
    localStorage.setItem("currentChat", username);
    window.location.href="chat.html";
  }

  function buildContactRow(username, lastMsg){
    const row = document.createElement("div");
    row.className = "p-3 border-b cursor-pointer hover:bg-gray-100 flex items-center gap-3";
    row.addEventListener("click", ()=> openChat(username));

    const avatar = document.createElement("div");
    avatar.className = "w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0";
    avatar.style.backgroundColor = avatarColor(username);
    avatar.textContent = avatarLabel(username);

    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";

    const nameDiv = document.createElement("div");
    nameDiv.className = "font-medium truncate";
    nameDiv.textContent = username;

    const previewDiv = document.createElement("div");
    previewDiv.className = "text-sm text-gray-500 truncate";
    previewDiv.textContent = lastMsg ? lastMsg.text : "Нет сообщений";

    info.appendChild(nameDiv);
    info.appendChild(previewDiv);

    row.appendChild(avatar);
    row.appendChild(info);

    if(lastMsg){
      const timeDiv = document.createElement("div");
      timeDiv.className = "text-xs text-gray-400 flex-shrink-0";
      timeDiv.textContent = lastMsg.time;
      row.appendChild(timeDiv);
    }

    return row;
  }

  // Список чатов (все зарегистрированные пользователи кроме текущего)
  async function renderChats(){
    chatList.innerHTML = "";
    try{
      const [usersRes, lastMsgRes] = await Promise.all([
        fetch("/search?username="),
        fetch(`/last-messages?user=${encodeURIComponent(currentUser)}`)
      ]);
      if(!usersRes.ok) return;
      const allUsers = await usersRes.json();
      const lastMessages = lastMsgRes.ok ? await lastMsgRes.json() : {};

      const contacts = allUsers.filter(u => u !== currentUser);
      contacts.sort((a,b)=>{
        const ma = lastMessages[a], mb = lastMessages[b];
        if(ma && mb) return mb.id - ma.id;
        if(ma) return -1;
        if(mb) return 1;
        return 0;
      });

      contacts.forEach(u=>{
        chatList.appendChild(buildContactRow(u, lastMessages[u]));
      });
    } catch(err){
      chatList.textContent = "Не удалось загрузить список чатов";
    }
  }

  // Поиск контактов
  searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();
    if (!query) {
      searchResult.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(`/search?username=${encodeURIComponent(query)}`);
      const data = await res.json();
      searchResult.innerHTML = "";
      if (res.ok) {
        data
          .filter(u => u !== currentUser)
          .forEach(username => {
            const row = document.createElement("div");
            row.className = "flex items-center gap-2 cursor-pointer mb-1";

            const avatar = document.createElement("div");
            avatar.className = "w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0";
            avatar.style.backgroundColor = avatarColor(username);
            avatar.textContent = avatarLabel(username);

            const label = document.createElement("span");
            label.className = "text-blue-600 hover:underline";
            label.textContent = username;

            row.appendChild(avatar);
            row.appendChild(label);
            row.addEventListener("click", () => openChat(username));
            searchResult.appendChild(row);
          });
      } else searchResult.textContent = data.error;
    } catch (err) {
      searchResult.textContent = "Ошибка соединения";
    }
  });

  // Выход
  logoutBtn.addEventListener("click", ()=>{ logoutModal.classList.remove("hidden"); logoutModal.classList.add("flex"); });
  confirmLogout.addEventListener("click", ()=>{
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentChat");
    window.location.href="index.html";
  });
  cancelLogout.addEventListener("click", ()=>{ logoutModal.classList.add("hidden"); logoutModal.classList.remove("flex"); });

  renderChats();
});
