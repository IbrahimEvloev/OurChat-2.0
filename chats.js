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

  function openChat(phone){
    localStorage.setItem("currentChat", phone);
    window.location.href="chat.html";
  }

  // Список чатов (все зарегистрированные пользователи кроме текущего)
  async function renderChats(){
    chatList.innerHTML = "";
    try{
      const res = await fetch("/search?phone=");
      const data = await res.json();
      if(!res.ok) return;
      data
        .filter(u => u !== currentUser)
        .forEach(u=>{
          const div = document.createElement("div");
          div.className="p-3 border-b cursor-pointer hover:bg-gray-100";
          div.textContent = u;
          div.addEventListener("click", ()=> openChat(u));
          chatList.appendChild(div);
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
      const res = await fetch(`/search?phone=${encodeURIComponent(query)}`);
      const data = await res.json();
      searchResult.innerHTML = "";
      if (res.ok) {
        data
          .filter(u => u !== currentUser)
          .forEach(phone => {
            const div = document.createElement("div");
            div.textContent = phone;
            div.className = "cursor-pointer text-blue-600 hover:underline mb-1";
            div.addEventListener("click", () => openChat(phone));
            searchResult.appendChild(div);
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
