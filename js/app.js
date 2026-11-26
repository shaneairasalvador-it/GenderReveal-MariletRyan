(() => {
  "use strict";

  const API = {
    health: "/api/health",
    poll: "/api/poll",
    rsvps: "/api/rsvps",
  };
  const MY_RSVP_KEY = "gender-reveal-my-rsvp-v2";
  const RSVP_DEVICE_KEY = "gender-reveal-rsvp-device-v2";
  const RSVP_STORE_KEY = "gender-reveal-rsvp-store-v2";
  const POLL_VOTER_KEY = "gender-reveal-poll-voter-v2";
  const POLL_STORE_KEY = "gender-reveal-poll-store-v2";
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
    voteBoy: document.getElementById("voteBoy"),
    voteGirl: document.getElementById("voteGirl"),
    countBoy: document.getElementById("countBoy"),
    countGirl: document.getElementById("countGirl"),
    barBoy: document.getElementById("barBoy"),
    barGirl: document.getElementById("barGirl"),
    pollTotal: document.getElementById("pollTotal"),
    pollStatus: document.getElementById("pollStatus"),
  };

  /** @type {boolean | null} */
  let apiOnline = null;

  function makeId(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getOrCreateId(key, prefix) {
    let id = localStorage.getItem(key);
    if (!id) {
      id = makeId(prefix);
      localStorage.setItem(key, id);
    }
    return id;
  }

  async function apiGet(url) {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`GET ${url} failed`);
    return response.json();
  }

  async function apiPost(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `POST ${url} failed`);
    }
    return data;
  }

  async function detectApi() {
    if (apiOnline !== null) return apiOnline;
    try {
      const data = await apiGet(API.health);
      apiOnline = Boolean(data && data.ok);
    } catch {
      apiOnline = false;
    }
    return apiOnline;
  }

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

  /* ---------- RSVP ---------- */
  /** @type {Array<{name: string, attendance: "yes" | "no", at: number, deviceId?: string}>} */
  let rsvps = [];

  function getMyRsvp() {
    return localStorage.getItem(MY_RSVP_KEY);
  }

  function setMyRsvp(name) {
    localStorage.setItem(MY_RSVP_KEY, name);
  }

  function loadLocalRsvps() {
    try {
      const raw = localStorage.getItem(RSVP_STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-60) : [];
    } catch {
      return [];
    }
  }

  function saveLocalRsvps() {
    localStorage.setItem(RSVP_STORE_KEY, JSON.stringify(rsvps.slice(-60)));
  }

  function renderRsvp() {
    if (!els.yesCount || !els.noCount) return;

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

  async function refreshRsvps() {
    if (await detectApi()) {
      const data = await apiGet(API.rsvps);
      rsvps = Array.isArray(data.rsvps) ? data.rsvps : [];
      saveLocalRsvps();
    } else {
      rsvps = loadLocalRsvps();
    }
    renderRsvp();
  }

  els.form.addEventListener("submit", async (event) => {
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
    const deviceId = getOrCreateId(RSVP_DEVICE_KEY, "rsvp");
    els.submit.disabled = true;
    els.status.textContent = "Saving…";

    try {
      if (await detectApi()) {
        const data = await apiPost(API.rsvps, { deviceId, name, attendance });
        rsvps = Array.isArray(data.rsvps) ? data.rsvps : [];
        setMyRsvp(data.myName || name);
      } else {
        rsvps = loadLocalRsvps();
        if (rsvps.some((r) => r.deviceId === deviceId)) {
          setMyRsvp(name);
        } else {
          rsvps.push({ deviceId, name, attendance, at: Date.now() });
          saveLocalRsvps();
          setMyRsvp(name);
        }
      }
      renderRsvp();
      if (attendance === "yes") burstConfetti();
    } catch {
      rsvps = loadLocalRsvps();
      rsvps.push({ deviceId, name, attendance, at: Date.now() });
      saveLocalRsvps();
      setMyRsvp(name);
      renderRsvp();
      if (attendance === "yes") burstConfetti();
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

  /* ---------- Poll ---------- */
  /** @type {{ votes: Array<{ id: string, team: "boy" | "girl", at: number }>, boy: number, girl: number, total: number }} */
  let poll = { votes: [], boy: 0, girl: 0, total: 0 };

  function getVoterId() {
    return getOrCreateId(POLL_VOTER_KEY, "vote");
  }

  function tallyVotes(votes) {
    const boy = votes.filter((v) => v.team === "boy").length;
    const girl = votes.filter((v) => v.team === "girl").length;
    return { votes, boy, girl, total: boy + girl };
  }

  function loadLocalPoll() {
    try {
      const raw = localStorage.getItem(POLL_STORE_KEY);
      if (!raw) return tallyVotes([]);
      const parsed = JSON.parse(raw);
      const votes = Array.isArray(parsed.votes) ? parsed.votes : [];
      return tallyVotes(votes);
    } catch {
      return tallyVotes([]);
    }
  }

  function saveLocalPoll() {
    localStorage.setItem(POLL_STORE_KEY, JSON.stringify({ votes: poll.votes }));
  }

  function myPollVote() {
    const id = localStorage.getItem(POLL_VOTER_KEY);
    if (!id) return null;
    return poll.votes.find((v) => v.id === id) || null;
  }

  function renderPoll() {
    if (!els.countBoy || !els.countGirl) return;

    const boy = Number(poll.boy) || 0;
    const girl = Number(poll.girl) || 0;
    const total = Number(poll.total) || boy + girl;
    const boyPct = total ? Math.round((boy / total) * 100) : 0;
    const girlPct = total ? 100 - boyPct : 0;

    els.countBoy.textContent = String(boy);
    els.countGirl.textContent = String(girl);
    els.pollTotal.textContent = String(total);
    els.barBoy.style.width = `${boyPct}%`;
    els.barGirl.style.width = `${girlPct}%`;

    const mine = myPollVote();
    const voted = Boolean(mine);

    if (els.voteBoy) {
      els.voteBoy.disabled = voted;
      els.voteBoy.classList.toggle("is-selected", Boolean(mine && mine.team === "boy"));
    }
    if (els.voteGirl) {
      els.voteGirl.disabled = voted;
      els.voteGirl.classList.toggle("is-selected", Boolean(mine && mine.team === "girl"));
    }

    if (els.pollStatus && mine) {
      els.pollStatus.textContent =
        mine.team === "boy" ? "You voted Team Boy." : "You voted Team Girl.";
    }
  }

  async function refreshPoll() {
    if (await detectApi()) {
      const data = await apiGet(API.poll);
      poll = tallyVotes(Array.isArray(data.votes) ? data.votes : []);
      saveLocalPoll();
    } else {
      poll = loadLocalPoll();
    }
    renderPoll();
  }

  async function castVote(team) {
    if (team !== "boy" && team !== "girl") return;
    if (myPollVote()) {
      els.pollStatus.textContent = "You already voted on this device.";
      return;
    }

    if (els.voteBoy) els.voteBoy.disabled = true;
    if (els.voteGirl) els.voteGirl.disabled = true;
    els.pollStatus.textContent = "Saving…";

    const voterId = getVoterId();
    const vote = { id: voterId, team, at: Date.now() };

    try {
      if (await detectApi()) {
        const data = await apiPost(API.poll, { voterId, team });
        poll = tallyVotes(Array.isArray(data.votes) ? data.votes : []);
      } else {
        poll = loadLocalPoll();
        if (!poll.votes.some((v) => v.id === voterId)) {
          poll = tallyVotes([...poll.votes, vote]);
        }
      }
      saveLocalPoll();
      renderPoll();
      burstConfetti();
      els.pollStatus.textContent =
        team === "boy" ? "You voted Team Boy." : "You voted Team Girl.";
    } catch {
      poll = loadLocalPoll();
      if (!poll.votes.some((v) => v.id === voterId)) {
        poll = tallyVotes([...poll.votes, vote]);
      }
      saveLocalPoll();
      renderPoll();
      burstConfetti();
      els.pollStatus.textContent =
        team === "boy" ? "You voted Team Boy." : "You voted Team Girl.";
    }
  }

  if (els.voteBoy) els.voteBoy.addEventListener("click", () => castVote("boy"));
  if (els.voteGirl) els.voteGirl.addEventListener("click", () => castVote("girl"));

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

  loadUltrasound();
  rsvps = loadLocalRsvps();
  poll = loadLocalPoll();
  renderRsvp();
  renderPoll();

  refreshRsvps().catch(() => {
    rsvps = loadLocalRsvps();
    renderRsvp();
  });

  refreshPoll().catch(() => {
    poll = loadLocalPoll();
    renderPoll();
  });

  window.setInterval(() => {
    if (apiOnline) {
      refreshPoll().catch(() => {});
      refreshRsvps().catch(() => {});
    }
  }, 15000);
})();
