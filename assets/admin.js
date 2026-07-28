import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  enableNetwork,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  GeoPoint,
  getCountFromServer,
  documentId,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_EMAIL = "fields.zachary@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyCMU0G6hP8b3wQpAtEyH_6TXZdhF8LswA8",
  authDomain: "handiman-1b845.firebaseapp.com",
  projectId: "handiman-1b845",
  storageBucket: "handiman-1b845.firebasestorage.app",
  messagingSenderId: "993433400657",
  appId: "1:993433400657:web:b7974b0337c1de5ea44f70",
  measurementId: "G-YZ18P8N99J",
};

const TOP_COLLECTIONS = [
  { id: "games", label: "Games", defaultOrderBy: "dateStarted", defaultOrder: "desc" },
  { id: "gameCodes", label: "Share codes", defaultOrderBy: null },
  { id: "users", label: "Users", defaultOrderBy: "createdAt", defaultOrder: "desc" },
  { id: "courses_public", label: "Public courses", defaultOrderBy: "name", defaultOrder: "asc" },
  { id: "courseDeletionRequests", label: "Deletion requests", defaultOrderBy: "requestedAt", defaultOrder: "desc" },
  { id: "chats", label: "Chats", defaultOrderBy: null },
];

const KNOWN_SUBCOLLECTIONS = {
  users: ["players", "games", "courses_private"],
  chats: ["messages"],
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
enableNetwork(db).catch(() => {});

const state = {
  collections: TOP_COLLECTIONS,
  currentCollection: null,
  docs: [],
  selectedPath: null,
  collectionCounts: {},
  tableSort: { key: null, dir: "desc" },
};

const $ = (id) => document.getElementById(id);

function show(el, visible) {
  el.classList.toggle("hidden", !visible);
}

function showMessage(el, text, type = "error") {
  if (!text) {
    show(el, false);
    return;
  }
  el.textContent = text;
  el.className = `message ${type}`;
  show(el, true);
}

function isAdminUser(user) {
  // Email/password accounts may not always have emailVerified set;
  // the email match is the gate (plus Firestore rules for that email).
  return Boolean(
    user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) {
    return {
      _firestore_timestamp: true,
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (value instanceof GeoPoint) {
    return {
      _firestore_geopoint: true,
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  if (value && typeof value === "object" && value.pathname && typeof value.path === "string") {
    return { _firestore_reference: true, path: value.path };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    if (typeof value.toDate === "function" && typeof value.seconds === "number") {
      return {
        _firestore_timestamp: true,
        seconds: value.seconds,
        nanoseconds: value.nanoseconds || 0,
      };
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

function deserializeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && value._firestore_timestamp) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  if (typeof value === "object" && value._firestore_geopoint) {
    return new GeoPoint(value.latitude, value.longitude);
  }
  if (typeof value === "object" && value._firestore_reference) {
    return doc(db, value.path);
  }
  if (Array.isArray(value)) return value.map(deserializeValue);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deserializeValue(v);
    return out;
  }
  return value;
}

function summaryForDoc(collectionId, id, data, path) {
  const base = { id, path: path || `${collectionId}/${id}` };
  if (!data) return base;

  switch (collectionId) {
    case "games":
      return {
        ...base,
        courseName: data.courseName ?? "",
        ownerId: data.ownerId ?? "",
        dateStarted: data.dateStarted,
        dateEnded: data.dateEnded ?? null,
        shareCode: data.shareCode ?? "",
        playerCount: Array.isArray(data.players) ? data.players.length : 0,
      };
    case "gameCodes":
      return {
        ...base,
        gameId: data.gameId ?? "",
        userId: data.userId ?? "",
      };
    case "users":
      return {
        ...base,
        email: data.email ?? "",
        name: data.name ?? "",
        createdAt: data.createdAt ?? null,
      };
    case "courses_public":
      return {
        ...base,
        name: data.name ?? data.courseName ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
      };
    case "courseDeletionRequests":
      return {
        ...base,
        courseName: data.courseName ?? "",
        status: data.status ?? "",
        requestedByEmail: data.requestedByEmail ?? "",
        requestedAt: data.requestedAt ?? null,
      };
    default:
      break;
  }

  const previewKeys = ["name", "email", "courseName", "status", "ownerId", "gameId"];
  const preview = {};
  for (const key of previewKeys) {
    if (data[key] !== undefined) preview[key] = data[key];
  }
  return { ...base, ...preview };
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object" && value._firestore_timestamp) {
    const ms = value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
    return new Date(ms).toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function columnsForCollection(collectionId) {
  switch (collectionId) {
    case "games":
      return [
        { key: "id", label: "ID" },
        { key: "courseName", label: "Course" },
        { key: "ownerId", label: "Owner" },
        { key: "dateStarted", label: "Started" },
        { key: "dateEnded", label: "Ended" },
        { key: "shareCode", label: "Code" },
        { key: "playerCount", label: "Players" },
      ];
    case "gameCodes":
      return [
        { key: "id", label: "Code" },
        { key: "gameId", label: "Game ID" },
        { key: "userId", label: "User ID" },
      ];
    case "users":
      return [
        { key: "id", label: "UID" },
        { key: "email", label: "Email" },
        { key: "name", label: "Name" },
        { key: "createdAt", label: "Created" },
      ];
    case "courses_public":
      return [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
      ];
    case "courseDeletionRequests":
      return [
        { key: "id", label: "ID" },
        { key: "courseName", label: "Course" },
        { key: "status", label: "Status" },
        { key: "requestedByEmail", label: "Requested by" },
        { key: "requestedAt", label: "Requested at" },
      ];
    default:
      return [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "courseName", label: "Course" },
        { key: "status", label: "Status" },
        { key: "ownerId", label: "Owner" },
      ];
  }
}

function collectionLeafId(collectionPath) {
  const parts = collectionPath.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

function renderCollectionList() {
  const list = $("collection-list");
  list.innerHTML = "";
  for (const col of state.collections) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    const count = state.collectionCounts[col.id];
    btn.textContent =
      typeof count === "number" ? `${col.label} (${count})` : col.label;
    btn.classList.toggle("active", state.currentCollection?.id === col.id);
    btn.addEventListener("click", () => loadCollection(col));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function updatePanelTitle() {
  if (!state.currentCollection) return;
  const label = state.currentCollection.label;
  const id = state.currentCollection.id;
  if (id === "search" || String(id).includes("/")) {
    $("panel-title").textContent = label;
    return;
  }
  const count = state.collectionCounts[id];
  $("panel-title").textContent =
    typeof count === "number" ? `${label} (${count})` : label;
}

function sortValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object" && value._firestore_timestamp) {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value).toLowerCase();
  return String(value).toLowerCase();
}

function sortDocsByColumn(key, dir) {
  const direction = dir === "asc" ? 1 : -1;
  state.docs = [...state.docs].sort((a, b) => {
    const av = sortValue(a[key]);
    const bv = sortValue(b[key]);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av < bv) return -1 * direction;
    if (av > bv) return 1 * direction;
    return 0;
  });
}

function handleColumnSort(key) {
  if (state.tableSort.key === key) {
    state.tableSort.dir = state.tableSort.dir === "asc" ? "desc" : "asc";
  } else {
    state.tableSort.key = key;
    state.tableSort.dir = key === "createdAt" || key === "dateStarted" || key === "dateEnded" || key === "requestedAt"
      ? "desc"
      : "asc";
  }

  const sortSelect = $("sort-field");
  const hasServerField =
    sortSelect &&
    !sortSelect.disabled &&
    [...sortSelect.options].some((opt) => opt.value === key);

  if (hasServerField) {
    sortSelect.value = key;
    $("sort-order").value = state.tableSort.dir;
    refreshDocs();
    return;
  }

  // Document id isn't always in the dropdown; still sort locally.
  sortDocsByColumn(state.tableSort.key, state.tableSort.dir);
  renderTable();
}

function renderTable() {
  const collectionId = state.currentCollection?.id || "search";
  const leaf = collectionId.includes("/") ? collectionLeafId(collectionId) : collectionId;
  const columns = columnsForCollection(leaf === "search" ? "search" : leaf);
  const head = $("table-head");
  const body = $("table-body");

  head.innerHTML = "";
  const trHead = document.createElement("tr");
  for (const c of columns) {
    const th = document.createElement("th");
    th.className = "sortable";
    th.scope = "col";
    th.dataset.key = c.key;
    let label = c.label;
    if (state.tableSort.key === c.key) {
      label += state.tableSort.dir === "asc" ? " ↑" : " ↓";
      th.classList.add("sorted");
    }
    th.textContent = label;
    th.title = `Sort by ${c.label}`;
    th.addEventListener("click", (e) => {
      e.stopPropagation();
      handleColumnSort(c.key);
    });
    trHead.appendChild(th);
  }
  head.appendChild(trHead);

  body.innerHTML = "";
  for (const row of state.docs) {
    const tr = document.createElement("tr");
    tr.classList.toggle("selected", row.path === state.selectedPath);
    for (const col of columns) {
      const td = document.createElement("td");
      td.textContent = formatCell(row[col.key]);
      if (col.key === "id" || col.key === "ownerId" || col.key === "gameId") {
        td.classList.add("mono");
      }
      tr.appendChild(td);
    }
    tr.addEventListener("click", () => openDocument(row.path));
    body.appendChild(tr);
  }
}

function populateSortOptions(collection) {
  const select = $("sort-field");
  select.innerHTML = "";
  const options = [];
  if (collection.defaultOrderBy) options.push(collection.defaultOrderBy);
  const extras = {
    games: ["courseName", "ownerId", "dateEnded", "shareCode"],
    users: ["email", "name", "id"],
    courses_public: ["name", "city", "state", "id"],
    courseDeletionRequests: ["status", "courseName", "requestedByEmail"],
  };
  for (const field of extras[collection.id] || []) {
    if (!options.includes(field)) options.push(field);
  }
  if (options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(default)";
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const field of options) {
    const opt = document.createElement("option");
    opt.value = field;
    opt.textContent = field === "id" ? "id (UID)" : field;
    if (field === collection.defaultOrderBy) opt.selected = true;
    select.appendChild(opt);
  }
  $("sort-order").value = collection.defaultOrder || "desc";
}

async function fetchCollectionCount(collectionPath) {
  if (!collectionPath || collectionPath.includes("/") || collectionPath === "search") {
    return null;
  }
  try {
    const snap = await getCountFromServer(collection(db, collectionPath));
    return snap.data().count;
  } catch {
    return null;
  }
}

async function fetchCollectionDocs(collectionPath, options = {}) {
  const max = Math.min(Number(options.limit) || 50, 200);
  const orderField = options.orderBy || null;
  const orderDir = options.order === "asc" ? "asc" : "desc";
  const leaf = collectionLeafId(collectionPath);
  const colRef = collection(db, collectionPath);

  let snap;
  try {
    if (orderField === "id") {
      snap = await getDocs(query(colRef, orderBy(documentId(), orderDir), limit(max)));
    } else if (orderField) {
      snap = await getDocs(query(colRef, orderBy(orderField, orderDir), limit(max)));
    } else {
      snap = await getDocs(query(colRef, limit(max)));
    }
  } catch (err) {
    if (orderField) {
      snap = await getDocs(query(colRef, limit(max)));
    } else {
      throw err;
    }
  }

  return snap.docs.map((d) => {
    const data = serializeValue(d.data());
    return summaryForDoc(leaf, d.id, data, `${collectionPath}/${d.id}`);
  });
}

async function loadCollection(collectionMeta) {
  state.currentCollection = collectionMeta;
  state.tableSort = {
    key: collectionMeta.defaultOrderBy || null,
    dir: collectionMeta.defaultOrder || "desc",
  };
  updatePanelTitle();
  populateSortOptions(collectionMeta);
  renderCollectionList();
  await refreshDocs();
}

async function refreshDocs() {
  showMessage($("list-message"), "");
  if (!state.currentCollection) return;

  try {
    const collectionId = state.currentCollection.id;
    const [docs, count] = await Promise.all([
      fetchCollectionDocs(collectionId, {
        limit: $("limit-select").value,
        orderBy: $("sort-field").value,
        order: $("sort-order").value,
      }),
      fetchCollectionCount(collectionId),
    ]);

    state.docs = docs;
    if (typeof count === "number") {
      state.collectionCounts[collectionId] = count;
    }

    // Keep column-sort indicator in sync with toolbar when sorting via dropdown.
    const toolbarField = $("sort-field").value;
    if (toolbarField) {
      state.tableSort.key = toolbarField;
      state.tableSort.dir = $("sort-order").value === "asc" ? "asc" : "desc";
    }

    updatePanelTitle();
    renderCollectionList();
    renderTable();
  } catch (err) {
    showMessage($("list-message"), err.message);
  }
}

async function runSearch() {
  const q = $("search-input").value.trim();
  if (!q) return;

  state.currentCollection = { id: "search", label: "Search results" };
  $("panel-title").textContent = `Search: ${q}`;
  showMessage($("list-message"), "");
  renderCollectionList();

  try {
    const results = [];
    const code = q.toUpperCase().replace(/\s/g, "");

    const codeSnap = await getDoc(doc(db, "gameCodes", code));
    if (codeSnap.exists()) {
      const codeData = serializeValue(codeSnap.data());
      results.push(summaryForDoc("gameCodes", code, codeData));
      if (codeData.gameId) {
        const gameSnap = await getDoc(doc(db, "games", codeData.gameId));
        if (gameSnap.exists()) {
          results.push(summaryForDoc("games", codeData.gameId, serializeValue(gameSnap.data())));
        }
      }
    }

    const gameSnap = await getDoc(doc(db, "games", q));
    if (gameSnap.exists()) {
      results.push(summaryForDoc("games", q, serializeValue(gameSnap.data())));
    }

    const userSnap = await getDoc(doc(db, "users", q));
    if (userSnap.exists()) {
      results.push(summaryForDoc("users", q, serializeValue(userSnap.data())));
    }

    const email = q.toLowerCase();
    if (email.includes("@")) {
      const emailSnap = await getDocs(
        query(collection(db, "users"), where("email", "==", email), limit(5))
      );
      for (const d of emailSnap.docs) {
        results.push(summaryForDoc("users", d.id, serializeValue(d.data())));
      }
    }

    try {
      const ownerSnap = await getDocs(
        query(
          collection(db, "games"),
          where("ownerId", "==", q),
          orderBy("dateStarted", "desc"),
          limit(25)
        )
      );
      for (const d of ownerSnap.docs) {
        results.push(summaryForDoc("games", d.id, serializeValue(d.data())));
      }
    } catch {
      // Index may be missing; skip owner search quietly.
    }

    const needle = q.toLowerCase();
    const recent = await getDocs(
      query(collection(db, "games"), orderBy("dateStarted", "desc"), limit(200))
    );
    for (const d of recent.docs) {
      const data = serializeValue(d.data());
      if (String(data.courseName || "").toLowerCase().includes(needle)) {
        results.push(summaryForDoc("games", d.id, data));
      }
      if (results.length >= 40) break;
    }

    const seen = new Set();
    state.docs = results.filter((r) => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    });

    if (state.docs.length === 0) {
      showMessage($("list-message"), "No results.", "error");
    }
    renderTable();
  } catch (err) {
    showMessage($("list-message"), err.message);
  }
}

function knownSubsForPath(path) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 2) {
    return KNOWN_SUBCOLLECTIONS[parts[0]] || [];
  }
  return [];
}

async function openDocument(path) {
  state.selectedPath = path;
  renderTable();
  showMessage($("editor-message"), "");

  try {
    const snap = await getDoc(doc(db, path));
    if (!snap.exists()) throw new Error("Document not found");

    $("editor-title").textContent = snap.id;
    $("editor-path").textContent = path;
    $("editor-json").value = JSON.stringify(serializeValue(snap.data()), null, 2);

    const subEl = $("subcollections");
    subEl.innerHTML = "";
    for (const sub of knownSubsForPath(path)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${sub} ›`;
      btn.addEventListener("click", () => openSubcollection(path, sub));
      subEl.appendChild(btn);
    }
  } catch (err) {
    showMessage($("editor-message"), err.message);
  }
}

async function openSubcollection(parentPath, subName) {
  const collectionPath = `${parentPath}/${subName}`;
  state.currentCollection = {
    id: collectionPath,
    label: collectionPath,
    defaultOrderBy: null,
  };
  $("panel-title").textContent = collectionPath;
  $("sort-field").innerHTML = '<option value="">(default)</option>';
  $("sort-field").disabled = true;

  try {
    state.docs = await fetchCollectionDocs(collectionPath, { limit: 100 });
    renderTable();
  } catch (err) {
    showMessage($("list-message"), err.message);
  }
}

async function saveDocument(mode) {
  if (!state.selectedPath) return;
  showMessage($("editor-message"), "");

  let parsed;
  try {
    parsed = JSON.parse($("editor-json").value);
  } catch {
    showMessage($("editor-message"), "Invalid JSON.");
    return;
  }

  try {
    const data = deserializeValue(parsed);
    await setDoc(doc(db, state.selectedPath), data, { merge: mode === "merge" });
    showMessage($("editor-message"), `Saved (${mode}).`, "success");
    if (state.currentCollection && !String(state.currentCollection.id).includes("/")) {
      await refreshDocs();
    }
  } catch (err) {
    showMessage($("editor-message"), err.message);
  }
}

async function deleteDocument() {
  if (!state.selectedPath) return;
  const ok = confirm(`Delete ${state.selectedPath}? This cannot be undone.`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, state.selectedPath));
    state.selectedPath = null;
    $("editor-json").value = "";
    $("editor-path").textContent = "";
    $("subcollections").innerHTML = "";
    showMessage($("editor-message"), "Document deleted.", "success");
    await refreshDocs();
  } catch (err) {
    showMessage($("editor-message"), err.message);
  }
}

async function enterApp(user) {
  $("admin-email").textContent = user.email;
  show($("login-screen"), false);
  show($("app"), true);
  renderCollectionList();
  if (!state.currentCollection) {
    await loadCollection(state.collections[0]);
  }
}

async function rejectNonAdmin(user) {
  await signOut(auth);
  show($("app"), false);
  show($("login-screen"), true);
  showMessage(
    $("login-error"),
    `Access denied for ${user.email || "this account"}. Only ${ADMIN_EMAIL} is allowed.`
  );
}

async function handlePasswordLogin(event) {
  event.preventDefault();
  showMessage($("login-error"), "");

  const email = ($("email-input").value || "").trim().toLowerCase();
  const password = $("password-input").value || "";

  if (email !== ADMIN_EMAIL.toLowerCase()) {
    showMessage($("login-error"), `Only ${ADMIN_EMAIL} can access admin.`);
    return;
  }
  if (!password) {
    showMessage($("login-error"), "Enter your password.");
    return;
  }

  const btn = $("login-btn");
  btn.disabled = true;
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (!isAdminUser(result.user)) {
      await rejectNonAdmin(result.user);
    }
  } catch (err) {
    const code = err && err.code ? String(err.code) : "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      showMessage($("login-error"), "Wrong email or password.");
    } else if (code === "auth/operation-not-allowed") {
      showMessage(
        $("login-error"),
        "Email/password sign-in is not enabled in Firebase Authentication."
      );
    } else {
      showMessage($("login-error"), err.message || "Sign-in failed.");
    }
  } finally {
    btn.disabled = false;
  }
}

function bindEvents() {
  $("login-form").addEventListener("submit", handlePasswordLogin);
  $("sign-out-btn").addEventListener("click", () => signOut(auth));
  $("refresh-btn").addEventListener("click", refreshDocs);
  $("sort-field").addEventListener("change", refreshDocs);
  $("sort-order").addEventListener("change", refreshDocs);
  $("limit-select").addEventListener("change", refreshDocs);
  $("search-btn").addEventListener("click", runSearch);
  $("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
  $("save-merge-btn").addEventListener("click", () => saveDocument("merge"));
  $("save-replace-btn").addEventListener("click", () => saveDocument("replace"));
  $("delete-btn").addEventListener("click", deleteDocument);
}

bindEvents();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    show($("app"), false);
    show($("login-screen"), true);
    return;
  }
  if (!isAdminUser(user)) {
    await rejectNonAdmin(user);
    return;
  }
  await enterApp(user);
});
