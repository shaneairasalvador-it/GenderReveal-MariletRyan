(() => {
  "use strict";

  const RSVP_KEY = "little-bear-rsvp-v1";
  const MY_RSVP_KEY = "little-bear-my-rsvp-v1";
  const ULTRA_KEY = "little-bear-ultrasound-v1";

  const els = {
    form: document.getElementById("rsvpForm"),
    guestName: document.getElementById("guestName"),
    submit: document.getElementById("rsvpSubmit"),
    status: document.getElementById("rsvpStatus"),
    summary: document.getElementById("rsvpSummary"),
    yesCount: document.getElementById("yesCount"),
    noCount: document.getElementById("noCount"),
    list: document.getElementById("rsvpList"),
    ultraInput: document.getElementById("ultraInput"),
    ultraEmpty: document.getElementById("ultraEmpty"),
    ultraPreview: document.getElementById("ultraPreview"),
    ultraClear: document.getElementById("ultraClear"),
    canvas: document.getElementById("confettiCanvas"),
    gate: document.getElementById("envelopeGate"),
    openBtn: document.getElementById("openInvite"),
    envelope: document.getElementById("envelope"),
  };

  /* ---------- Envelope open ---------- */
  let opening = false;

  function openInvitation() {
    if (opening || !els.gate || !els.envelope) return;
    opening = true;
    els.envelope.classList.add("is-opening");
    els.gate.classList.add("is-opening-out");
    els.openBtn.disabled = true;

    if (typeof burstConfetti === "function") {
      window.setTimeout(() => burstConfetti(), 280);
    }

    window.setTimeout(() => {
      els.gate.classList.add("is-open");
      document.body.classList.remove("invite-locked");
      document.body.classList.add("invite-open");
      window.scrollTo({ top: 0, behavior: "instant" });
      window.setTimeout(() => {
        els.gate.setAttribute("aria-hidden", "true");
        els.gate.style.display = "none";
      }, 650);
    }, 1100);
  }

  if (els.openBtn) {
    els.openBtn.addEventListener("click", openInvitation);
    els.openBtn.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openInvitation();
      }
    });
  }

  /** @type {Array<{name: string, attendance: "yes" | "no", at: number}>} */
  let rsvps = loadRsvps();

  function loadRsvps() {
    try {
      const raw = localStorage.getItem(RSVP_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-60) : [];
    } catch {
      return [];
    }
  }

  function saveRsvps() {
    localStorage.setItem(RSVP_KEY, JSON.stringify(rsvps));
    try {
      const channel = new BroadcastChannel("little-bear-rsvp");
      channel.postMessage({ type: "sync", rsvps });
      channel.close();
    } catch {
      /* unsupported */
    }
  }

  function getMyRsvp() {
    return localStorage.getItem(MY_RSVP_KEY);
  }

  function setMyRsvp(name) {
    localStorage.setItem(MY_RSVP_KEY, name);
  }

  function renderRsvp() {
    const yes = rsvps.filter((r) => r.attendance === "yes").length;
    const no = rsvps.filter((r) => r.attendance === "no").length;

    els.yesCount.textContent = String(yes);
    els.noCount.textContent = String(no);
    els.summary.hidden = rsvps.length === 0;

    els.list.innerHTML = "";
    rsvps
      .slice()
      .reverse()
      .slice(0, 20)
      .forEach((entry) => {
        const li = document.createElement("li");
        li.className = entry.attendance;
        li.textContent =
          entry.attendance === "yes"
            ? `${entry.name} · coming`
            : `${entry.name} · can't make it`;
        els.list.appendChild(li);
      });

    if (getMyRsvp()) {
      els.submit.disabled = true;
      els.guestName.disabled = true;
      els.form.querySelectorAll('input[name="attendance"]').forEach((input) => {
        input.disabled = true;
      });
      els.status.textContent = `Thanks, ${getMyRsvp()}! We got your RSVP.`;
    }
  }

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (getMyRsvp()) {
      els.status.textContent = "You already sent an RSVP on this device.";
      return;
    }

    const name = (els.guestName.value || "").trim().slice(0, 40);
    const attendanceInput = els.form.querySelector(
      'input[name="attendance"]:checked'
    );

    if (!name || !attendanceInput) {
      els.status.textContent = "Please add your name and pick an option.";
      return;
    }

    const attendance = /** @type {"yes" | "no"} */ (attendanceInput.value);

    rsvps.push({ name, attendance, at: Date.now() });
    if (rsvps.length > 60) rsvps = rsvps.slice(-60);

    setMyRsvp(name);
    saveRsvps();
    renderRsvp();

    if (attendance === "yes") {
      burstConfetti();
    }
  });

  /* ---------- Ultrasound ---------- */
  function showUltrasound(dataUrl) {
    els.ultraPreview.src = dataUrl;
    els.ultraPreview.hidden = false;
    els.ultraEmpty.hidden = true;
    els.ultraClear.hidden = false;
  }

  function clearUltrasound() {
    localStorage.removeItem(ULTRA_KEY);
    els.ultraPreview.removeAttribute("src");
    els.ultraPreview.hidden = true;
    els.ultraEmpty.hidden = false;
    els.ultraClear.hidden = true;
    els.ultraInput.value = "";
  }

  function loadUltrasound() {
    const saved = localStorage.getItem(ULTRA_KEY);
    if (saved) showUltrasound(saved);
  }

  els.ultraInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.size > 4.5 * 1024 * 1024) {
      alert("Please choose a photo under 4.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      try {
        localStorage.setItem(ULTRA_KEY, dataUrl);
      } catch {
        alert("Could not save the photo on this device. Preview still works for now.");
      }
      showUltrasound(dataUrl);
    };
    reader.readAsDataURL(file);
  });

  els.ultraClear.addEventListener("click", clearUltrasound);

  /* ---------- Confetti ---------- */
  const ctx = els.canvas.getContext("2d");
  let pieces = [];
  let confettiRunning = false;

  function resizeCanvas() {
    els.canvas.width = window.innerWidth;
    els.canvas.height = window.innerHeight;
  }

  function burstConfetti() {
    resizeCanvas();
    const colors = ["#b8956c", "#d9cfc2", "#a8b5a0", "#7ea8c4", "#d9899c", "#ffffff"];

    for (let i = 0; i < 80; i += 1) {
      pieces.push({
        x: Math.random() * els.canvas.width,
        y: -20 - Math.random() * 80,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: -0.2 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 90 + Math.floor(Math.random() * 40),
      });
    }

    if (!confettiRunning) {
      confettiRunning = true;
      requestAnimationFrame(tickConfetti);
    }
  }

  function tickConfetti() {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    pieces = pieces.filter((p) => p.life > 0);

    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.vr;
      p.life -= 1;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(p.life / 100, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (pieces.length) {
      requestAnimationFrame(tickConfetti);
    } else {
      confettiRunning = false;
      ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    }
  }

  window.addEventListener("resize", resizeCanvas);

  /* ---------- Scroll reveal ---------- */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));

  try {
    const channel = new BroadcastChannel("little-bear-rsvp");
    channel.onmessage = (event) => {
      if (event.data && event.data.type === "sync" && Array.isArray(event.data.rsvps)) {
        rsvps = event.data.rsvps;
        renderRsvp();
      }
    };
  } catch {
    /* ignore */
  }

  window.addEventListener("storage", (event) => {
    if (event.key === RSVP_KEY || event.key === MY_RSVP_KEY) {
      rsvps = loadRsvps();
      renderRsvp();
    }
    if (event.key === ULTRA_KEY) loadUltrasound();
  });

  loadUltrasound();
  renderRsvp();
})();
