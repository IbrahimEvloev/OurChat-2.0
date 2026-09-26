document.addEventListener("DOMContentLoaded", () => {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  const loginName = document.getElementById("loginName");
  const loginPassword = document.getElementById("loginPassword");
  const regName = document.getElementById("regName");
  const regPassword = document.getElementById("regPassword");

  function normalizePhone(input){
    return input.replace(/\D/g,'');
  }

  function setupAutoPlus7(input){
    input.addEventListener("focus", ()=>{
      if(!input.value.startsWith("+7")) input.value = "+7";
    });
    input.addEventListener("input", ()=>{
      if(!input.value.startsWith("+7")) input.value = "+7" + input.value.replace(/\D/g,'');
    });
  }

  setupAutoPlus7(loginName);
  setupAutoPlus7(regName);

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
    const phone = normalizePhone(regName.value.trim());
    const password = regPassword.value.trim();
    if(!phone || !password){ alert("Заполните все поля"); return; }

    try{
      const res = await fetch("/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({phone, password})
      });
      const data = await res.json();
      if(res.ok){
        localStorage.setItem("currentUser", phone);
        window.location.replace("chats.html");
      } else alert(data.error);
    } catch(err){ alert("Ошибка сервера"); }
  });

  loginForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const phone = normalizePhone(loginName.value.trim());
    const password = loginPassword.value.trim();
    if(!phone || !password){ alert("Заполните все поля"); return; }

    try{
      const res = await fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({phone, password})
      });
      const data = await res.json();
      if(res.ok){
        localStorage.setItem("currentUser", phone);
        window.location.replace("chats.html");
      } else alert(data.error);
    } catch(err){ alert("Ошибка сервера"); }
  });
});
