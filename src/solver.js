import { LOG } from "./logger.js";
import { getSetting } from "./config.js";
import { getQuizDoc } from "./dom.js";
import { dbState } from "./database.js";
import { gmFetch } from "./network.js";
import { shouldMissQuestion } from "./features.js";

let isSolvingQuestion = false;
let lastAnsweredQuestionText = "";
let lastAiAttemptTime = 0;

export async function checkAndAnswerQuestion() {
  if (!getSetting("AutoAnswer") || isSolvingQuestion) return;
  const qDoc = getQuizDoc();
  if (!qDoc) return;

  
  if (!getSetting("AntiDelay") && qDoc.querySelector(".mark-return")) return;

  const currentBtn = qDoc.querySelector(".plainbtn.alt.icon.yellow.selected, .plainbtn.alt.icon.selected");
  const currentQNumStr = currentBtn?.innerText?.replace(/\D/g, "")?.slice(-1) || "1";
  const qIndex = currentBtn ? (parseInt(currentBtn.innerText, 10) - 1) : 0;
  const missThis = shouldMissQuestion(qIndex);

  let matched = false;

  
  if (dbState.isReady) {
    
    const radios = qDoc.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      if (missThis) {
        const wrongRadios = Array.from(radios).filter(r => !r.id || !dbState.idSet.has(r.id));
        if (wrongRadios.length > 0) {
          const r = wrongRadios[Math.floor(Math.random() * wrongRadios.length)];
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          if (!r.checked) r.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
          matched = true;
          LOG.info("RANGE", `Intentionally selected wrong radio on question #${qIndex + 1}`);
        }
      } else {
        radios.forEach(r => {
          if (r.id && dbState.idSet.has(r.id) && !r.checked) {
            r.checked = true;
            r.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            if (!r.checked) r.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
            matched = true;
            LOG.success("SOLVER-DB", `Selected matching radio: ${r.id}`);
          }
        });
      }
    }

    
    const checkboxes = qDoc.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      if (missThis) {
        const wrongCbs = Array.from(checkboxes).filter(cb => !cb.id || !dbState.idSet.has(cb.id));
        if (wrongCbs.length > 0) {
          const cb = wrongCbs[Math.floor(Math.random() * wrongCbs.length)];
          cb.checked = true;
          cb.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          if (!cb.checked) cb.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
          matched = true;
        }
      } else {
        checkboxes.forEach(cb => {
          if (cb.id && dbState.idSet.has(cb.id) && !cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            if (!cb.checked) cb.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
            matched = true;
            LOG.success("SOLVER-DB", `Selected matching checkbox: ${cb.id}`);
          }
        });
      }
    }

    
    const selects = qDoc.querySelectorAll("select");
    if (selects.length > 0) {
      if (missThis) {
        const wrongSelects = Array.from(selects).filter(sel => Array.from(sel.options).some(opt => !opt.id || !dbState.idSet.has(opt.id)));
        if (wrongSelects.length > 0) {
          const sel = wrongSelects[Math.floor(Math.random() * wrongSelects.length)];
          const wrongOpts = Array.from(sel.options).filter(opt => !opt.id || !dbState.idSet.has(opt.id));
          if (wrongOpts.length > 0) {
            const opt = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
            sel.value = opt.value;
            sel.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            matched = true;
          }
        }
      } else {
        selects.forEach(sel => {
          Array.from(sel.options).forEach(opt => {
            if (opt.id && dbState.idSet.has(opt.id) && sel.value !== opt.value) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
              matched = true;
              LOG.success("SOLVER-DB", `Selected dropdown option: ${opt.value}`);
            }
          });
        });
      }
    }

    
    const textInputs = qDoc.querySelectorAll('input[type="text"]');
    if (textInputs.length > 0) {
      textInputs.forEach(txt => {
        if (missThis) {
          txt.value = "1";
          txt.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          matched = true;
        } else {
          const ans = dbState.answers.get(txt.id);
          if (ans && !txt.value) {
            txt.value = ans;
            txt.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
            matched = true;
            LOG.success("SOLVER-DB", `Filled text answer: "${ans}" for ${txt.id}`);
          }
        }
      });
    }

    
    const questionContainers = qDoc.getElementsByClassName("Assessment_Main_Body_Content_Question");
    const activeQuestions = Array.from(questionContainers).filter(q => q.style.display !== "none" && q.id.includes("q_"));
    if (activeQuestions.length > 0) {
      activeQuestions.forEach(qEl => {
        const ta = qEl.querySelector("textarea");
        if (ta && !ta.value) {
          if (!missThis) {
            ta.value = qEl.innerText.trim();
            ta.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
            matched = true;
          }
        }
      });
    }
  }

  
  if (matched) {
    const delayMs = Math.max(400, (Number(getSetting("AnswerDelay")) || 2) * 1000);
    autoSubmitQuestion(qDoc, delayMs);
    return;
  }

  
  const currentQEl = qDoc.querySelector(".Assessment_Main_Body_Content_Question:not([style*='display: none']), [qid]");
  const qText = currentQEl ? (currentQEl.innerText || "").trim() : "";
  const now = Date.now();

  if (getSetting("AiFallback") && getSetting("APIKey") && qText && qText !== lastAnsweredQuestionText && now - lastAiAttemptTime > 5000) {
    lastAnsweredQuestionText = qText;
    lastAiAttemptTime = now;
    await solveWithAi(qDoc);
  }
}

export function autoSubmitQuestion(doc, delayMs = 1000) {
  setTimeout(() => {
    
    const currentBtn = doc.querySelector(".plainbtn.alt.icon.yellow.selected, .plainbtn.alt.icon.selected");
    const allQBtns = Array.from(doc.querySelectorAll(".plainbtn.alt.icon.yellow, .plainbtn.alt.icon"));
    const currentQNum = currentBtn ? parseInt(currentBtn.innerText, 10) : -Infinity;
    const maxQNum = allQBtns.reduce((max, b) => {
      const v = parseInt(b.innerText, 10);
      return isNaN(v) ? max : Math.max(max, v);
    }, -Infinity);

    if (currentQNum >= maxQNum && maxQNum > 0) {
      
      LOG.success("SOLVER", `Final question (#${currentQNum}/${maxQNum}) completed. Submitting assessment...`);
      const submitBtn = doc.getElementById("submit") || doc.querySelector(".uibtn.uibtn-blue.uibtn-med.submit");
      submitBtn?.click();
      setTimeout(() => {
        const confirmBtn = doc.querySelector(".uibtn.uibtn-blue.uibtn-med.submit") || document.querySelector(".uibtn.uibtn-blue.uibtn-med.submit");
        confirmBtn?.click();
      }, 150);
    } else {
      
      const nextQBtn = doc.getElementById("nextQuestion") || doc.querySelector("#nextQuestion, .nextQuestion, [title*='Next']");
      if (nextQBtn) {
        LOG.info("SOLVER", `Question #${currentQNum || ""} answered. Advancing to next question...`);
        nextQBtn.click();
      }
    }

    
    if (allQBtns.length === 0) {
      const nextQ = doc.getElementById("nextQuestion");
      if (nextQ && nextQ.offsetParent !== null) {
        nextQ.click();
        return;
      }
      const submitBtn = doc.getElementById("submit") || doc.querySelector("input[value='Submit'], button[value='Submit'], .uibtn-blue[value='Submit']");
      if (submitBtn) {
        submitBtn.click();
        setTimeout(() => {
          const confirmBtn = doc.querySelector(".uibtn.uibtn-blue.uibtn-med.submit");
          confirmBtn?.click();
        }, 150);
      }
    }
  }, delayMs);
}

export async function solveWithAi(doc) {
  const apiKey = getSetting("APIKey");
  if (!apiKey) return;

  const currentQEl = doc.querySelector(".Assessment_Main_Body_Content_Question:not([style*='display: none']), [qid]");
  if (!currentQEl) return;

  const questionText = (currentQEl.innerText || "").trim();
  if (!questionText || questionText.length < 5) return;

  isSolvingQuestion = true;
  LOG.info("AI-SOLVER", `AI fallback analyzing question: "${questionText.slice(0, 70)}..."`);

  try {
    const options = Array.from(currentQEl.querySelectorAll("li, label, .answer-choice, input[type='radio'], input[type='checkbox']"))
      .map(el => (el.innerText || el.value || "").trim())
      .filter(t => t.length > 0);

    const prompt = `You are an educational assistant answering a school assessment question.
Question: ${questionText}
${options.length > 0 ? "Options:\n" + options.map((o, i) => `${i + 1}. ${o}`).join("\n") : ""}

Respond ONLY with the exact correct answer text. Do not provide explanations or quotes.`;

    const provider = getSetting("AIProvider");
    const model = getSetting("AIModel") || "llama-3.3-70b-versatile";
    let endpoint = "https://api.groq.com/openai/v1/chat/completions";

    if (provider === "cerebras") endpoint = "https://api.cerebras.ai/v1/chat/completions";
    else if (provider === "openrouter") endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const response = await gmFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} from ${provider}`);

    const json = await response.json();
    const aiAnswer = json.choices?.[0]?.message?.content?.trim();
    LOG.success("AI-SOLVER", `AI Answer: "${aiAnswer}"`);

    if (aiAnswer) {
      const labels = currentQEl.querySelectorAll("label");
      let clicked = false;
      for (const lbl of labels) {
        if (lbl.innerText.toLowerCase().includes(aiAnswer.toLowerCase())) {
          const input = lbl.querySelector("input") || doc.getElementById(lbl.getAttribute("for"));
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("click", { bubbles: true }));
            clicked = true;
            break;
          }
        }
      }

      const txt = currentQEl.querySelector('input[type="text"], textarea');
      if (txt && !clicked) {
        txt.value = aiAnswer;
        txt.dispatchEvent(new Event("input", { bubbles: true }));
      }

      autoSubmitQuestion(doc, 1000);
    }
  } catch (err) {
    LOG.error("AI-SOLVER", "AI fallback error:", err);
  } finally {
    setTimeout(() => { isSolvingQuestion = false; }, 2000);
  }
}
