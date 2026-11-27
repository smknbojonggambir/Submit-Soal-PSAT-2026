(() => {
  "use strict";

  const { SCRIPT_URL, MAX_FILE_MB } = window.CONFIG;
  const EXT = { kisi: ["pdf", "doc", "docx", "xls", "xlsx"], soal: ["doc", "docx"] };
  const TEXT_FIELDS = ["namaGuru", "mapel", "kelas", "jumlahSoal", "linkForm", "catatan"];
  const DEFAULT_DROP = "Klik untuk upload atau tarik dan lepas";

  const $ = (id) => document.getElementById(id);
  const form = $("form");
  const fieldset = $("fieldset");
  const statusEl = $("status");
  let submissionId = newId(); // sama saat kirim ulang, agar data tidak ganda
  let sending = false;

  document.querySelectorAll(".max-mb").forEach((el) => (el.textContent = MAX_FILE_MB));

  // Gambar gagal dimuat: tampilkan teks pengganti
  document.querySelectorAll("img[data-fallback]").forEach((img) => {
    const fallback = () => {
      img.parentElement.dataset.fallback = img.dataset.fallback;
      img.parentElement.classList.add("no-img");
      img.remove();
    };
    if (img.complete && !img.naturalWidth) fallback();
    else img.addEventListener("error", fallback);
  });

  function updateProgress() {
    const required = TEXT_FIELDS.filter((name) => name !== "catatan");
    const done =
      required.filter((name) => !checkText(name, $(name).value.trim())).length +
      Object.keys(EXT).filter((key) => !checkFile(key, $(key).files[0])).length;
    const total = required.length + Object.keys(EXT).length;
    $("progressBar").value = done;
    $("progressText").textContent = `${done} dari ${total}`;
  }

  function newId() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function setError(name, message) {
    $("err-" + name)?.replaceChildren(message);
    const input = $(name);
    input.closest(".field").classList.toggle("invalid", !!message);
    input.setAttribute("aria-invalid", String(!!message));
  }

  function extensionOf(filename) {
    return filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
  }

  function checkFile(key, file) {
    if (!file) return "File wajib diunggah.";
    if (!EXT[key].includes(extensionOf(file.name))) {
      return "Format harus " + EXT[key].join(", ").toUpperCase() + ".";
    }
    if (file.size === 0) return "File kosong.";
    if (file.size > MAX_FILE_MB * 1024 * 1024) return `Ukuran file melebihi ${MAX_FILE_MB} MB.`;
    return "";
  }

  function parseUrl(value) {
    try { return new URL(value); } catch { return null; }
  }

  function checkText(name, value) {
    if (name === "catatan") return "";
    if (!value) return "Wajib diisi.";
    if (name === "jumlahSoal") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 200) return "Isi angka bulat 1 sampai 200.";
    }
    if (name === "linkForm") {
      const url = parseUrl(value);
      const ok = url && url.protocol === "https:" &&
        (url.hostname === "forms.gle" ||
          (url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/")));
      if (!ok) return "Gunakan link Google Form (https://forms.gle/... atau https://docs.google.com/forms/...).";
    }
    return "";
  }

  // ---------- Upload: klik atau tarik-lepas ----------
  function showFile(key) {
    const input = $(key);
    const zone = input.closest(".drop");
    const file = input.files[0];
    zone.classList.toggle("filled", !!file);
    zone.querySelector("strong").textContent = file
      ? `${file.name} (${(file.size / 1048576).toFixed(2)} MB)`
      : DEFAULT_DROP;
    zone.parentElement.querySelector(".remove").hidden = !file;
    updateProgress();
  }

  function onFileChange(key) {
    const input = $(key);
    const file = input.files[0];
    const problem = file ? checkFile(key, file) : "";
    if (problem) input.value = "";
    showFile(key);
    setError(key, problem);
  }

  Object.keys(EXT).forEach((key) => {
    const input = $(key);
    const zone = input.closest(".drop");
    input.addEventListener("change", () => onFileChange(key));
    ["dragenter", "dragover"].forEach((type) =>
      zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.add("over"); }));
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("over");
      if (sending || !e.dataTransfer.files.length) return;
      const transfer = new DataTransfer();
      transfer.items.add(e.dataTransfer.files[0]);
      input.files = transfer.files;
      onFileChange(key);
    });
  });

  // Cegah browser membuka file jika dilepas di luar kotak upload
  ["dragover", "drop"].forEach((type) => window.addEventListener(type, (e) => e.preventDefault()));

  document.querySelectorAll(".remove").forEach((button) =>
    button.addEventListener("click", () => {
      $(button.dataset.key).value = "";
      showFile(button.dataset.key);
    }));

  TEXT_FIELDS.forEach((name) =>
    $(name).addEventListener("input", () => {
      setError(name, "");
      updateProgress();
      if (name === "linkForm") {
        const url = parseUrl($(name).value.trim());
        $("warn-linkForm").textContent = url && /\/edit\/?$/.test(url.pathname)
          ? "Ini tampaknya link edit. Biasanya yang dibagikan adalah link dari tombol Kirim / Publikasikan."
          : "";
      }
    }));

  // ---------- Pengiriman ----------
  function validate() {
    const problems = [];
    TEXT_FIELDS.forEach((name) => {
      // input number mengembalikan "" jika isinya bukan angka
      const message = checkText(name, $(name).value.trim());
      setError(name, message);
      if (message) problems.push(name);
    });
    Object.keys(EXT).forEach((key) => {
      const message = checkFile(key, $(key).files[0]);
      setError(key, message);
      if (message) problems.push(key);
    });
    if (problems.length) $(problems[0]).focus();
    return problems.length === 0;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(",")[1] });
      reader.onerror = () => reject(new Error(`File "${file.name}" tidak bisa dibaca. Pilih ulang file tersebut.`));
      reader.readAsDataURL(file);
    });
  }

  function showStatus(message, bad = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("bad", bad);
  }

  function setSending(value) {
    sending = value;
    fieldset.disabled = value;
    $("tombol").textContent = value ? "Mengirim..." : "Submit Soal";
  }

  window.addEventListener("beforeunload", (e) => { if (sending) e.preventDefault(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    showStatus("");
    if (!validate()) return showStatus("Periksa kembali isian yang ditandai merah.", true);
    if (!SCRIPT_URL) {
      return showStatus("Aplikasi belum terhubung ke Google Drive. Admin perlu mengisi SCRIPT_URL di config.js.", true);
    }

    const payload = { submissionId };
    TEXT_FIELDS.forEach((name) => (payload[name] = $(name).value.trim()));
    setSending(true);
    showStatus("Sedang mengunggah. Jangan tutup halaman ini...");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    try {
      payload.kisi = await readFile($("kisi").files[0]);
      payload.soal = await readFile($("soal").files[0]);

      // Tanpa header Content-Type khusus agar tidak terkena preflight CORS
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Server menjawab ${response.status}.`);
      const result = await response.json();
      if (!result.ok) throw new Error(result.message || "Pengiriman ditolak server.");

      $("nomorBukti").textContent = result.receipt;
      $("ringkasan").textContent = `${payload.mapel} · Kelas ${payload.kelas} · ${payload.namaGuru}`;
      showStatus("");
      form.hidden = true;
      $("sukses").hidden = false;
      $("sukses").focus();
    } catch (error) {
      let message = error.message;
      if (error.name === "AbortError") message = "Waktu pengiriman habis.";
      else if (error instanceof TypeError || error instanceof SyntaxError) {
        message = "Tidak mendapat jawaban yang benar dari server. Periksa koneksi internet.";
      }
      showStatus(`Gagal: ${message} Data Anda masih ada, silakan tekan Submit Soal lagi.`, true);
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
  });

  updateProgress(); // browser bisa memulihkan isian setelah muat ulang

  $("kirimLagi").addEventListener("click", () => {
    const nama = $("namaGuru").value; // nama guru dipertahankan
    form.reset();
    $("namaGuru").value = nama;
    Object.keys(EXT).forEach(showFile);
    $("warn-linkForm").textContent = "";
    submissionId = newId();
    $("sukses").hidden = true;
    form.hidden = false;
    $("mapel").focus();
  });
})();
