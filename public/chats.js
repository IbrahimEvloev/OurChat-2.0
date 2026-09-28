document.addEventListener("DOMContentLoaded", ()=>{
  const chatList = document.getElementById("chatList");
  const logoutBtn = document.getElementById("logoutBtn");
  const searchInput = document.getElementById("searchInput");
  const searchClear = document.getElementById("searchClear");
  const searchResult = document.getElementById("searchResult");
  const myAvatar = document.getElementById("myAvatar");
  const myName = document.getElementById("myName");

  const logoutModal = document.getElementById("logoutModal");
  const confirmLogout = document.getElementById("confirmLogout");
  const cancelLogout = document.getElementById("cancelLogout");

  const currentUser = localStorage.getItem("currentUser");
  if(!currentUser){ window.location.href="index.html"; return; }

  // ---------- Иконки ----------
  const CHECK_SINGLE = `<svg width="15" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7.5"/></svg>`;
  const CHECK_DOUBLE = `<svg width="17" height="14" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8.5l3 3 7-7.5"/><path d="M6.5 8.5l3 3 7-7.5"/></svg>`;
  const CHAT_ICON = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 20.5l1.4-4.9A8.4 8.4 0 1 1 21 11.5z"/></svg>`;
  const SEARCH_ICON = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`;

  // ---------- Хелперы ----------
  function h(tag, cls, text){
    const el = document.createElement(tag);
    if(cls) el.className = cls;
    if(text != null) el.textContent = text;
    return el;
  }
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

  myAvatar.textContent = avatarLabel(currentUser);
  myAvatar.style.backgroundColor = avatarColor(currentUser);
  myName.textContent = currentUser;

  function buildAvatar(username){
    const wrap = h("div", "relative flex-shrink-0");
    const av = h("div", "w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm", avatarLabel(username));
    av.style.backgroundColor = avatarColor(username);
    wrap.appendChild(av);

    const dot = h("span", "hidden absolute right-0 bottom-0 w-3.5 h-3.5 rounded-full");
    dot.dataset.presence = username;
    dot.style.background = "var(--online)";
    dot.style.boxShadow = "0 0 0 2px #fff";
    wrap.appendChild(dot);
    return wrap;
  }

  function previewText(msg){
    if(msg.audio) return "🎤 Голосовое сообщение";
    return String(msg.text || "").replace(/\s+/g, " ").trim();
  }

  function formatWhen(msg){
    const ts = Number(msg.id);
    if(!ts) return msg.time || "";
    const d = new Date(ts);
    const now = new Date();
    const startOf = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
    if(diffDays <= 0) return msg.time || d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    if(diffDays === 1) return "Вчера";
    if(diffDays < 7) return d.toLocaleDateString("ru-RU", { weekday: "short" });
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }

  // ---------- Статус "в сети" ----------
  function loadPresence(usernames){
    usernames.forEach(async u=>{
      try{
        const res = await fetch(`/status?user=${encodeURIComponent(u)}`);
        const data = await res.json();
        document.querySelectorAll(`[data-presence="${CSS.escape(u)}"]`).forEach(el=>{
          el.classList.toggle("hidden", !data.online);
        });
      } catch(err){}
    });
  }

  // ---------- Строки ----------
  let knownContacts = {}; // username -> last message

  function buildChatRow(username, lastMsg){
    const own = lastMsg.from === currentUser;
    const unread = !own && !lastMsg.read;

    const row = h("button", "chat-row row-in w-full text-left flex items-center gap-3 px-4 py-3");
    row.type = "button";
    row.addEventListener("click", ()=> openChat(username));
    row.appendChild(buildAvatar(username));

    const info = h("div", "flex-1 min-w-0 flex flex-col gap-0.5");

    // верхняя строка: ник + время/галочки
    const top = h("div", "flex items-center gap-2");
    top.appendChild(h("span", "flex-1 min-w-0 truncate text-[15px] " + (unread ? "font-bold" : "font-semibold"), username));

    const meta = h("span", "flex items-center gap-1 flex-shrink-0 text-[11px]");
    meta.style.color = unread ? "var(--ink)" : "var(--muted)";
    if(own){
      const checks = h("span", "flex items-center");
      checks.innerHTML = lastMsg.read ? CHECK_DOUBLE : CHECK_SINGLE;
      checks.style.color = lastMsg.read ? "var(--mine)" : "var(--muted)";
      meta.appendChild(checks);
    }
    meta.appendChild(h("span", "tabular-nums", formatWhen(lastMsg)));
    top.appendChild(meta);

    // нижняя строка: превью + точка непрочитанного
    const bottom = h("div", "flex items-center gap-2");
    const prev = h("span", "flex-1 min-w-0 truncate text-sm");
    prev.style.color = unread ? "var(--ink)" : "var(--muted)";
    if(unread) prev.style.fontWeight = "500";
    if(own){
      const you = h("span", "", "Вы: ");
      you.style.color = "var(--theirs)";
      prev.appendChild(you);
    }
    prev.appendChild(document.createTextNode(previewText(lastMsg)));
    bottom.appendChild(prev);
    if(unread) bottom.appendChild(h("span", "unread-dot flex-shrink-0"));

    info.appendChild(top);
    info.appendChild(bottom);
    row.appendChild(info);
    return row;
  }

  function buildSearchRow(username){
    const existing = knownContacts[username];
    const row = h("button", "chat-row row-in w-full text-left flex items-center gap-3 px-4 py-3");
    row.type = "button";
    row.addEventListener("click", ()=> openChat(username));
    row.appendChild(buildAvatar(username));

    const info = h("div", "flex-1 min-w-0 flex flex-col gap-0.5");
    info.appendChild(h("span", "truncate text-[15px] font-semibold", username));
    const sub = h("span", "truncate text-sm", existing ? "Открыть переписку" : "Начать новый чат");
    sub.style.color = "var(--muted)";
    info.appendChild(sub);
    row.appendChild(info);
    return row;
  }

  // ---------- Состояния ----------
  function stateBlock(iconSvg, title, hint, actionLabel, onAction, dotted){
    const wrap = h("div", "min-h-full flex flex-col items-center justify-center text-center px-8 py-10 gap-1" + (dotted ? " dotted" : ""));
    const icon = h("div", "w-16 h-16 rounded-full flex items-center justify-center mb-3");
    icon.style.background = "#fff";
    icon.style.color = "var(--mine)";
    icon.style.boxShadow = "0 0 0 1px rgba(140,120,180,0.15)";
    icon.innerHTML = iconSvg;
    wrap.appendChild(icon);
    wrap.appendChild(h("div", "wordmark text-lg", title));
    const hintEl = h("div", "text-sm max-w-[240px]", hint);
    hintEl.style.color = "var(--muted)";
    wrap.appendChild(hintEl);
    if(actionLabel){
      const btn = h("button", "mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white", actionLabel);
      btn.type = "button";
      btn.style.background = "var(--mine)";
      btn.addEventListener("click", onAction);
      wrap.appendChild(btn);
    }
    return wrap;
  }

  function showSkeleton(){
    chatList.innerHTML = "";
    for(let i=0;i<5;i++){
      const row = h("div", "flex items-center gap-3 px-4 py-3 animate-pulse");
      const av = h("div", "w-12 h-12 rounded-full flex-shrink-0");
      av.style.background = "var(--soft)";
      const col = h("div", "flex-1 flex flex-col gap-2");
      const l1 = h("div", "h-3 rounded-full"); l1.style.background = "var(--soft)"; l1.style.width = (35 + (i*11)%25) + "%";
      const l2 = h("div", "h-3 rounded-full"); l2.style.background = "var(--soft)"; l2.style.width = (55 + (i*17)%35) + "%";
      col.appendChild(l1); col.appendChild(l2);
      row.appendChild(av); row.appendChild(col);
      chatList.appendChild(row);
    }
  }

  // ---------- Список чатов ----------
  async function renderChats(){
    showSkeleton();
    try{
      const res = await fetch(`/last-messages?user=${encodeURIComponent(currentUser)}`);
      if(!res.ok) throw new Error("bad response");
      const lastMessages = await res.json();
      knownContacts = lastMessages;
      const contacts = Object.keys(lastMessages);

      chatList.innerHTML = "";
      if(contacts.length === 0){
        chatList.appendChild(stateBlock(
          CHAT_ICON,
          "Пока нет чатов",
          "Найдите друга по нику в поиске сверху и напишите первым",
          "Найти собеседника",
          ()=> searchInput.focus(),
          true
        ));
        return;
      }

      contacts.sort((a,b)=> lastMessages[b].id - lastMessages[a].id);
      contacts.forEach(u=>{
        chatList.appendChild(buildChatRow(u, lastMessages[u]));
      });
      loadPresence(contacts);
    } catch(err){
      chatList.innerHTML = "";
      chatList.appendChild(stateBlock(
        CHAT_ICON,
        "Не удалось загрузить",
        "Проверьте соединение и попробуйте ещё раз",
        "Повторить",
        renderChats,
        true
      ));
    }
  }

  // ---------- Поиск ----------
  let searchTimer = null;
  let searchSeq = 0;

  function setSearchMode(on){
    searchResult.classList.toggle("hidden", !on);
    chatList.classList.toggle("hidden", on);
    searchClear.classList.toggle("hidden", !on);
    searchClear.classList.toggle("flex", on);
  }

  async function runSearch(){
    const query = searchInput.value.trim();
    const seq = ++searchSeq;
    if(!query){
      setSearchMode(false);
      searchResult.innerHTML = "";
      return;
    }
    setSearchMode(true);

    try{
      const res = await fetch(`/search?username=${encodeURIComponent(query)}`);
      const data = await res.json();
      if(seq !== searchSeq) return; // пришёл устаревший ответ

      const users = res.ok ? data.filter(u => u !== currentUser) : [];
      searchResult.innerHTML = "";

      if(users.length === 0){
        searchResult.appendChild(stateBlock(
          SEARCH_ICON,
          "Никого не нашли",
          `Пользователя «${query}» нет. Проверьте ник — он должен совпадать точно`,
          null, null, true
        ));
        return;
      }
      users.forEach(u => searchResult.appendChild(buildSearchRow(u)));
      loadPresence(users);
    } catch(err){
      if(seq !== searchSeq) return;
      searchResult.innerHTML = "";
      searchResult.appendChild(stateBlock(
        SEARCH_ICON,
        "Ошибка соединения",
        "Не получилось выполнить поиск. Попробуйте ещё раз",
        null, null, true
      ));
    }
  }

  searchInput.addEventListener("input", ()=>{
    clearTimeout(searchTimer);
    if(!searchInput.value.trim()){ runSearch(); return; }
    searchTimer = setTimeout(runSearch, 200);
  });
  searchInput.addEventListener("keydown", e=>{
    if(e.key === "Escape"){ searchInput.value = ""; runSearch(); searchInput.blur(); }
  });
  searchClear.addEventListener("click", ()=>{
    searchInput.value = "";
    runSearch();
    searchInput.focus();
  });

  // ---------- Выход ----------
  function openLogoutModal(){ logoutModal.classList.remove("hidden"); logoutModal.classList.add("flex"); }
  function closeLogoutModal(){ logoutModal.classList.add("hidden"); logoutModal.classList.remove("flex"); }

  logoutBtn.addEventListener("click", openLogoutModal);
  cancelLogout.addEventListener("click", closeLogoutModal);
  logoutModal.addEventListener("click", e=>{ if(e.target === logoutModal) closeLogoutModal(); });
  document.addEventListener("keydown", e=>{
    if(e.key === "Escape" && !logoutModal.classList.contains("hidden")) closeLogoutModal();
  });
  confirmLogout.addEventListener("click", ()=>{
    try{
      fetch("/logout", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username: currentUser }),
        keepalive: true
      });
    } catch(err){}
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentChat");
    window.location.href="index.html";
  });

  renderChats();
});
