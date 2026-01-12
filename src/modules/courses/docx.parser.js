const mammoth = require("mammoth");

const parseDocx = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });

  const lines = result.value
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const modules = [];
  let currentModule = null;
  let currentChapter = null;

  for (const line of lines) {

    /* =========================
       MODULE: 1. Module Title
    ========================= */
    if (/^\d+\.\s+/.test(line)) {
      if (currentModule) {
        modules.push(currentModule);
      }

      currentModule = {
        title: line,
        chapters: []
      };

      currentChapter = null;
      continue;
    }

    /* =========================
       CHAPTER: 1.1 Chapter Title
    ========================= */
    if (/^\d+\.\d+\s+/.test(line)) {
      if (!currentModule) {
        // Ignore chapters before module
        continue;
      }

      currentChapter = {
        title: line,
        content: ""
      };

      currentModule.chapters.push(currentChapter);
      continue;
    }

    /* =========================
       CONTENT
    ========================= */
    if (currentChapter) {
      currentChapter.content += line + "\n\n";
    }
  }

  // Push last module
  if (currentModule) {
    modules.push(currentModule);
  }

  return modules;
};

module.exports = { parseDocx };
