document.addEventListener("DOMContentLoaded", () => {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  const loginName = document.getElementById("loginName");
  const loginPassword = document.getElementById("loginPassword");
  const regName = document.getElementById("regName");
  const regPassword = document.getElementById("regPassword");

  const USERNAME_REGEX = /^[a-zA-Zа-яА-ЯёЁ0-9_.-]{3,20}$/;

  function isValidUsername(username){
    return USERNAME_REGEX.test(username);
  }

  loginTab.addEventListener("click", ()=>{
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    loginTab.classList.add("border-blue-500","border-b-2");
    registerTab.classList.remove("border-blue-500","border-b-2");
  });

  registerTab.addEventListener("click", ()=>{
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    registerTab.classList.add("border-blue-500","border-b-2");
    loginTab.classList.remove("border-blue-500","border-b-2");
  });

  registerForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const username = regName.value.trim();
    const password = regPassword.value.trim();
    if(!username || !password){ alert("Заполните все поля"); return; }
    if(!isValidUsername(username)){
      alert("Ник: 3-20 символов, разрешены буквы, цифры, _ . -");
      return;
    }

    try{
      const res = await fetch("/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
      });
      const data = await res.json();
      if(res.ok){
        localStorage.setItem("currentUser", username);
        window.location.replace("chats.html");
      } else alert(data.error);
    } catch(err){ alert("Ошибка сервера"); }
  });

  loginForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const username = loginName.value.trim();
    const password = loginPassword.value.trim();
    if(!username || !password){ alert("Заполните все поля"); return; }

    try{
      const res = await fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
      });
      const data = await res.json();
      if(res.ok){
        localStorage.setItem("currentUser", username);
        window.location.replace("chats.html");
      } else alert(data.error);
    } catch(err){ alert("Ошибка сервера"); }
  });
});
