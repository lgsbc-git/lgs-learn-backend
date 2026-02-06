const mammoth = require("mammoth");

const parseDocx = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });

  const lines = result.value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const modules = [];
  let currentModule = null;
  let currentChapter = null;

  for (const line of lines) {
    /* =========================
       CHAPTER: 1.1 Chapter Title (check FIRST, before module check)
    ========================= */
    if (/^\d+\.\d+\s/.test(line)) {
      // Matches "1.1 " or "1.1\t" (must have whitespace after the number)
      if (!currentModule) {
        // Ignore chapters before module
        continue;
      }

      currentChapter = {
        title: line,
        content: "",
      };

      currentModule.chapters.push(currentChapter);
      continue;
    }

    /* =========================
       MODULE: 1. Module Title
    ========================= */
    if (/^\d+\.\s/.test(line) && !/^\d+\.\d+/.test(line)) {
      // Matches "1. ", "2. ", etc. but NOT "1.1", "2.2", etc.
      if (currentModule) {
        modules.push(currentModule);
      }

      currentModule = {
        title: line,
        chapters: [],
      };

      currentChapter = null;
      continue;
    }

    /* =========================
       CONTENT
    ========================= */
    if (currentModule) {
      // If no chapter exists yet, create a default one using module title
      if (!currentChapter) {
        currentChapter = {
          title: currentModule.title, // Use module title as chapter name
          content: "",
        };
        currentModule.chapters.push(currentChapter);
      }

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
