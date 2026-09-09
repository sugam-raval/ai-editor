// AI Template Studio Interactive Engine & API Client
document.addEventListener("DOMContentLoaded", () => {
  // Preset Template Collections
  const TEMPLATE_PRESETS = {
    ecommerce_banner: {
      canvas: {
        width: 800,
        height: 450,
        backgroundColor: "#0f172a"
      },
      layers: [
        {
          id: "bg_accent",
          type: "frame",
          x: 0,
          y: 0,
          width: 800,
          height: 450,
          backgroundColor: "#1e1b4b"
        },
        {
          id: "main_headline",
          type: "text",
          x: 60,
          y: 80,
          width: 680,
          height: 100,
          text: "EXCLUSIVE MEGA SALE 50% OFF",
          fontFamily: "Plus Jakarta Sans",
          fontSize: 44,
          fontWeight: 800,
          color: "#f59e0b",
          textAlign: "left"
        },
        {
          id: "sub_headline",
          type: "text",
          x: 60,
          y: 190,
          width: 650,
          height: 60,
          text: "Upgrade your design workflow with AI-driven automated template customization.",
          fontFamily: "Plus Jakarta Sans",
          fontSize: 20,
          fontWeight: 400,
          color: "#94a3b8",
          textAlign: "left"
        },
        {
          id: "cta_button",
          type: "text",
          x: 60,
          y: 290,
          width: 240,
          height: 54,
          text: "SHOP THE DEAL",
          fontFamily: "Plus Jakarta Sans",
          fontSize: 18,
          fontWeight: 700,
          color: "#ffffff",
          backgroundColor: "#6366f1",
          textAlign: "center",
          borderRadius: 10
        }
      ]
    },

    social_post: {
      canvas: {
        width: 600,
        height: 600,
        backgroundColor: "#111827"
      },
      layers: [
        {
          id: "bg_card",
          type: "frame",
          x: 30,
          y: 30,
          width: 540,
          height: 540,
          backgroundColor: "#1f2937"
        },
        {
          id: "post_tag",
          type: "text",
          x: 70,
          y: 70,
          width: 200,
          height: 30,
          text: "NEW PRODUCT ANNOUNCEMENT",
          fontSize: 14,
          fontWeight: 700,
          color: "#a855f7"
        },
        {
          id: "main_title",
          type: "text",
          x: 70,
          y: 120,
          width: 460,
          height: 120,
          text: "Introducing AI Template Editor v1.0",
          fontSize: 36,
          fontWeight: 800,
          color: "#ffffff"
        },
        {
          id: "post_description",
          type: "text",
          x: 70,
          y: 260,
          width: 460,
          height: 140,
          text: "LangGraph-powered tool calling with token-pruned JSON architecture for instant visual edits.",
          fontSize: 18,
          color: "#d1d5db"
        }
      ]
    },

    event_flyer: {
      canvas: {
        width: 700,
        height: 500,
        backgroundColor: "#020617"
      },
      layers: [
        {
          id: "banner_text",
          type: "text",
          x: 50,
          y: 60,
          width: 600,
          height: 70,
          text: "FUTURE OF AGENTIC DESIGN 2026",
          fontSize: 38,
          fontWeight: 800,
          color: "#38bdf8"
        },
        {
          id: "event_sub",
          type: "text",
          x: 50,
          y: 150,
          width: 600,
          height: 50,
          text: "Keynote & Live Hands-On AI Workshop",
          fontSize: 22,
          color: "#cbd5e1"
        },
        {
          id: "date_badge",
          type: "text",
          x: 50,
          y: 250,
          width: 300,
          height: 48,
          text: "SEPTEMBER 25 • ONLINE",
          fontSize: 16,
          fontWeight: 700,
          color: "#ffffff",
          backgroundColor: "#ec4899",
          textAlign: "center"
        }
      ]
    }
  };

  // State Management
  let CUSTOM_LIDOJS_TEMPLATE = null;
  let currentTemplate = JSON.parse(JSON.stringify(TEMPLATE_PRESETS.ecommerce_banner));
  let originalPrunedContext = null;
  let appliedMutations = [];
  let isInspectMode = false;
  let activeTab = "tab-json";
  let activeJsonSubtab = "full";
  let targetLayerId = null;

  function setTargetLayer(layerId, labelText) {
    if (!layerId || layerId === "ROOT" || layerId === "bg_accent" || layerId === "bg_card") {
      clearTargetLayer();
      return;
    }
    targetLayerId = layerId;
    const banner = document.getElementById("target-layer-banner");
    const nameEl = document.getElementById("target-layer-name");
    if (banner && nameEl) {
      nameEl.textContent = labelText || layerId;
      nameEl.title = `Targeted Layer ID: ${layerId}`;
      banner.classList.remove("hidden");
    }
  }

  function clearTargetLayer() {
    targetLayerId = null;
    const banner = document.getElementById("target-layer-banner");
    if (banner) {
      banner.classList.add("hidden");
    }
  }

  // Undo / Redo History Management
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY_LIMIT = 30;

  function saveHistoryState() {
    if (!currentTemplate) return;
    undoStack.push(JSON.parse(JSON.stringify(currentTemplate)));
    if (undoStack.length > MAX_HISTORY_LIMIT) {
      undoStack.shift();
    }
    redoStack = [];
    updateHistoryButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.parse(JSON.stringify(currentTemplate)));
    currentTemplate = undoStack.pop();
    updateHistoryButtons();

    renderCanvas();
    updatePrunedStats();
    updateJsonInspector();
    updateMutationsTab();
    showToast("Undid last change ↶", "info");
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.parse(JSON.stringify(currentTemplate)));
    currentTemplate = redoStack.pop();
    updateHistoryButtons();

    renderCanvas();
    updatePrunedStats();
    updateJsonInspector();
    updateMutationsTab();
    showToast("Redid change ↷", "info");
  }

  function updateHistoryButtons() {
    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  // DOM Elements
  const canvasFrame = document.getElementById("canvas-frame");
  const templateSelect = document.getElementById("template-select");
  const promptInput = document.getElementById("prompt-input");
  const submitPromptBtn = document.getElementById("submit-prompt-btn");
  const resetBtn = document.getElementById("reset-btn");
  const inspectModeBtn = document.getElementById("inspect-mode-btn");
  const jsonDisplay = document.getElementById("json-display");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const origSizeVal = document.getElementById("orig-size-val");
  const prunedSizeVal = document.getElementById("pruned-size-val");
  const savingsBar = document.getElementById("savings-bar");
  const savingsText = document.getElementById("savings-text");
  const selectedLayerInfo = document.getElementById("selected-layer-info");
  const mutationsTimeline = document.getElementById("mutations-timeline");
  const mutationCountBadge = document.getElementById("mutation-count-badge");
  const aiResponseBox = document.getElementById("ai-response-box");

  // Initialize
  init();

  async function init() {
    setupEventListeners();
    initPanelResize();
    await checkBackendHealth();
    await loadCustomTemplateJson();
    // Default to custom LidoJS template preset
    if (CUSTOM_LIDOJS_TEMPLATE) {
      currentTemplate = JSON.parse(JSON.stringify(CUSTOM_LIDOJS_TEMPLATE));
      templateSelect.value = "custom_lidojs";
    }
    renderCanvas();
    await updatePrunedStats();
    updateJsonInspector();
  }

  const HARDCODED_CUSTOM_TEMPLATE = [{"layers": {"ROOT": {"type": {"type": "bgImage", "resolvedName": "RootLayer"}, "child": ["e6faf939-2866-4252-a832-f7a78e6e6e60", "bfa48ce6-b765-4acc-847b-a35574e6a1ae", "661a5dbb-2468-474a-b79a-04d00ef46c4c", "1d83cb47-cc9f-4f67-8560-b6ef5f039890", "bdc5da1a-a0b2-4182-ab04-4450c5e75fe6"], "props": {"color": "#fff", "image": {"url": "https://assets.quickhub.ai/qh-templates-2/without_interior_design_65.png", "thumb": "https://assets.quickhub.ai/qh-templates-2/without_interior_design_65.png", "rotate": 0, "boxSize": {"width": 675, "height": 675}, "position": {"x": 0, "y": 0}}, "video": null, "rotate": 0, "boxSize": {"width": 675, "height": 675}, "position": {"x": 0, "y": 0}}, "locked": false, "parent": null}, "1d83cb47-cc9f-4f67-8560-b6ef5f039890": {"type": {"type": "website", "fixedText": "", "resolvedName": "TextLayer", "replacableText": "www.yourwebsite.com"}, "child": [], "props": {"doc": {"type": "doc", "content": [{"type": "paragraph", "attrs": {"color": "rgb(109, 172, 206)", "indent": 0, "fontSize": "30.288026px", "listType": "", "textAlign": "left", "fontFamily": "Roboto", "lineHeight": "1.4", "marginLeft": null, "letterSpacing": 0, "textTransform": ""}, "content": [{"text": "www.yourwebsite.com", "type": "text", "marks": [{"type": "color", "attrs": {"color": "rgb(109, 172, 206)"}}]}]}]}, "fonts": [], "scale": 0.6996, "colors": ["rgb(109, 172, 206)"], "rotate": 0, "boxSize": {"x": 523, "y": 259, "width": 375, "height": 29}, "position": {"x": 26, "y": 619}, "fontSizes": [30]}, "locked": false, "parent": "ROOT"}, "661a5dbb-2468-474a-b79a-04d00ef46c4c": {"type": {"type": "bodyText", "fixedText": "", "resolvedName": "TextLayer", "replacableText": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam leo tellus, placerat bibendum ex vel, rutrum eleifend libero."}, "child": [], "props": {"doc": {"type": "doc", "content": [{"type": "paragraph", "attrs": {"color": "rgb(109, 172, 206)", "indent": 0, "fontSize": "28.946958px", "listType": "", "textAlign": "left", "fontFamily": "Roboto", "lineHeight": 1.28, "marginLeft": null, "letterSpacing": 0, "textTransform": ""}, "content": [{"text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam leo tellus, placerat bibendum ex vel, rutrum eleifend libero.", "type": "text", "marks": [{"type": "color", "attrs": {"color": "rgb(109, 172, 206)"}}]}]}]}, "fonts": [], "scale": 0.678, "colors": ["rgb(109, 172, 206)"], "rotate": 0, "boxSize": {"x": 523, "y": 259, "width": 363, "height": 75}, "position": {"x": 26, "y": 523}, "fontSizes": [28]}, "locked": false, "parent": "ROOT"}, "bdc5da1a-a0b2-4182-ab04-4450c5e75fe6": {"type": {"type": "logo", "resolvedName": "FrameLayer"}, "child": [], "props": {"image": {"url": "https://assets.quickhub.ai/qh-assets/logo_black.png", "thumb": "https://assets.quickhub.ai/qh-assets/logo_black.png", "rotate": 0, "boxSize": {"width": 92, "height": 74}, "position": {"x": 0, "y": 0}}, "rotate": 0, "boxSize": {"width": 92, "height": 74}, "position": {"x": 248, "y": 11}}, "locked": false, "parent": "ROOT"}, "bfa48ce6-b765-4acc-847b-a35574e6a1ae": {"type": {"type": "bodyText", "fixedText": "", "resolvedName": "TextLayer", "replacableText": "make your dream home with us!"}, "child": [], "props": {"doc": {"type": "doc", "content": [{"type": "paragraph", "attrs": {"color": "rgb(0, 0, 0)", "indent": 0, "fontSize": "38px", "listType": "", "textAlign": "left", "fontFamily": "Roboto", "lineHeight": 1.09, "marginLeft": null, "letterSpacing": 0, "textTransform": "uppercase"}, "content": [{"text": "make your dream home with us!", "type": "text", "marks": [{"type": "color", "attrs": {"color": "rgb(109, 172, 206)"}}]}]}]}, "fonts": [], "scale": 0.626, "colors": ["rgb(0, 0, 0)", "rgb(109, 172, 206)"], "rotate": 0, "boxSize": {"x": 523, "y": 259, "width": 267, "height": 51}, "position": {"x": 26, "y": 457}, "fontSizes": [38]}, "locked": false, "parent": "ROOT"}, "e6faf939-2866-4252-a832-f7a78e6e6e60": {"type": {"type": "static", "fixedText": "interior design", "resolvedName": "TextLayer", "replacableText": ""}, "child": [], "props": {"doc": {"type": "doc", "content": [{"type": "paragraph", "attrs": {"color": "rgb(0, 0, 0)", "indent": 0, "fontSize": "68px", "listType": "", "textAlign": "right", "fontFamily": "Roboto", "lineHeight": 1.03, "marginLeft": null, "letterSpacing": 0, "textTransform": "uppercase"}, "content": [{"text": "interior design", "type": "text", "marks": [{"type": "bold"}, {"type": "color", "attrs": {"color": "rgb(109, 172, 206)"}}]}]}]}, "fonts": [], "scale": 0.869, "colors": ["rgb(0, 0, 0)", "rgb(109, 172, 206)"], "rotate": 0, "boxSize": {"x": 523, "y": 259, "width": 324, "height": 121}, "position": {"x": 294, "y": 76}, "fontSizes": [68]}, "locked": false, "parent": "ROOT"}}}];

  async function loadCustomTemplateJson() {
    try {
      const res = await fetch("/tests/custom_template.json?v=" + Date.now());
      if (res.ok) {
        CUSTOM_LIDOJS_TEMPLATE = await res.json();
      } else {
        CUSTOM_LIDOJS_TEMPLATE = HARDCODED_CUSTOM_TEMPLATE;
      }
    } catch (e) {
      console.warn("Could not load custom_template.json via fetch, using fallback:", e);
      CUSTOM_LIDOJS_TEMPLATE = HARDCODED_CUSTOM_TEMPLATE;
    }
  }


  // Event Listeners
  function setupEventListeners() {
    // Undo / Redo Toolbar Buttons
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) undoBtn.addEventListener("click", undo);

    const redoBtn = document.getElementById("redo-btn");
    if (redoBtn) redoBtn.addEventListener("click", redo);

    templateSelect.addEventListener("change", (e) => {
      saveHistoryState();
      const presetKey = e.target.value;
      if (presetKey === "custom_lidojs" && CUSTOM_LIDOJS_TEMPLATE) {
        currentTemplate = JSON.parse(JSON.stringify(CUSTOM_LIDOJS_TEMPLATE));
      } else if (TEMPLATE_PRESETS[presetKey]) {
        currentTemplate = JSON.parse(JSON.stringify(TEMPLATE_PRESETS[presetKey]));
      }
      appliedMutations = [];
      renderCanvas();
      updatePrunedStats();
      updateJsonInspector();
      updateMutationsTab();
      showToast("Template reset to preset: " + presetKey, "success");
    });

    // Manual Add Text Layer button
    const addTextBtn = document.getElementById("add-text-layer-btn");
    if (addTextBtn) {
      addTextBtn.addEventListener("click", () => {
        manuallyAddTextLayer();
      });
    }

    // Clear target layer button
    const clearTargetBtn = document.getElementById("clear-target-layer-btn");
    if (clearTargetBtn) {
      clearTargetBtn.addEventListener("click", clearTargetLayer);
    }

    submitPromptBtn.addEventListener("click", handlePromptSubmit);
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handlePromptSubmit();
      }
    });


    // Preset chip clicks
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        promptInput.value = chip.getAttribute("data-prompt");
        handlePromptSubmit();
      });
    });

    // Inspect mode toggle
    inspectModeBtn.addEventListener("click", () => {
      isInspectMode = !isInspectMode;
      inspectModeBtn.classList.toggle("active", isInspectMode);
      canvasFrame.querySelectorAll(".canvas-layer").forEach((el) => {
        el.classList.toggle("inspect-active", isInspectMode);
      });
    });

    // Tabs switching
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.getAttribute("data-tab");
        document.getElementById(activeTab).classList.add("active");
      });
    });

    // Subtab full vs pruned
    document.getElementById("subtab-full").addEventListener("click", (e) => {
      document.getElementById("subtab-full").classList.add("active");
      document.getElementById("subtab-pruned").classList.remove("active");
      activeJsonSubtab = "full";
      updateJsonInspector();
    });

    document.getElementById("subtab-pruned").addEventListener("click", (e) => {
      document.getElementById("subtab-pruned").classList.add("active");
      document.getElementById("subtab-full").classList.remove("active");
      activeJsonSubtab = "pruned";
      updateJsonInspector();
    });
  }

  // Draggable panel resize handle
  function initPanelResize() {
    const handle = document.getElementById("panel-resize-handle");
    const workspace = document.querySelector(".workspace");
    const leftPanel = document.querySelector(".panel.left-panel");
    if (!handle || !workspace || !leftPanel) return;

    let isResizing = false;

    handle.addEventListener("mousedown", (e) => {
      isResizing = true;
      handle.classList.add("active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(260, Math.min(700, e.clientX));
      workspace.style.gridTemplateColumns = `${newWidth}px 6px 1fr 380px`;
      leftPanel.style.width = `${newWidth}px`;
    });

    window.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        handle.classList.remove("active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });
  }

  // Simple markdown to HTML converter for AI chat messages
  function simpleMarkdown(text) {
    if (!text) return "";
    let html = text
      // Escape HTML entities first
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Code blocks (```)
      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code (`)
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      // Bold (**text**)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic (*text*)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Unordered list items (- item)
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      // Numbered list items (1. item)
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
      // Headings (### heading)
      .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#\s+(.+)$/gm, '<h3>$1</h3>')
      // Line breaks
      .replace(/\n/g, '<br>');
    return html;
  }

  function appendChatMessage(sender, text, targetId) {
    const chatStream = document.getElementById("chat-stream");
    if (!chatStream) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-message ${sender === "user" ? "user-message" : "assistant-message"}`;

    // Render markdown for AI messages, plain text for user
    let renderedContent = sender === "user" ? text : simpleMarkdown(text);
    if (sender === "user" && targetId) {
      renderedContent = `<div class="chat-target-tag">🎯 Target: <code>${targetId}</code></div><div>${renderedContent}</div>`;
    }

    msgDiv.innerHTML = `
      <div class="chat-avatar">${sender === "user" ? "You" : "AI"}</div>
      <div class="chat-bubble">${renderedContent}</div>
    `;
    chatStream.appendChild(msgDiv);
    chatStream.scrollTop = chatStream.scrollHeight;
  }

  // Health Check Endpoint API
  async function checkBackendHealth() {
    try {
      const response = await fetch("/health");
      if (response.ok) {
        const data = await response.json();
        statusDot.className = "status-dot green";
        statusText.textContent = data.openai_configured ? "Backend Connected (OpenAI Live)" : "Backend Connected (Mock/Key Pending)";
      } else {
        throw new Error("HTTP error " + response.status);
      }
    } catch (err) {
      statusDot.className = "status-dot red";
      statusText.textContent = "Backend Offline";
    }
  }

  // Submit Prompt to Backend AI Endpoint
  async function handlePromptSubmit() {
    const promptText = promptInput.value.trim();
    if (!promptText) {
      showToast("Please enter a message for the AI assistant.", "error");
      return;
    }

    const currentTargetId = targetLayerId;

    // Append user message to chat stream (including target badge if active)
    appendChatMessage("user", promptText, currentTargetId);
    promptInput.value = "";

    setLoadingState(true);

    let apiData = null;
    let apiFailed = false;

    // Step 1: Call the backend API
    try {
      const payload = {
        template_json: currentTemplate,
        user_prompt: promptText
      };
      if (currentTargetId) {
        payload.target_layer_id = currentTargetId;
      }

      const response = await fetch("/api/ai/edit-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        apiData = data;
      } else {
        console.error("Backend AI Edit error response:", response.status, data);
        showToast(`Backend error (${response.status}): ${data.detail || 'Failed to execute edit'}`, "error");
        appendChatMessage("assistant", `Error (${response.status}): ${data.detail || 'Could not process request'}`);
        apiFailed = true;
      }
    } catch (err) {
      console.error("API request failed (network error):", err);
      apiFailed = true;
    }

    // Step 2: If API failed, run local fallback
    if (apiFailed && !apiData) {
      simulateLocalAiMutation(promptText);
      setLoadingState(false);
      return;
    }

    // Step 3: Apply the successful API response — errors here won't hide the AI message
    if (apiData) {
      // Always show the real AI chat response first
      appendChatMessage("assistant", apiData.ai_message || "Design updated successfully!");

      // Then try to update canvas and UI
      try {
        saveHistoryState();
        currentTemplate = apiData.updated_json;
        if (apiData.mutations_applied && apiData.mutations_applied.length > 0) {
          appliedMutations.push(...apiData.mutations_applied);
        }

        renderCanvas();
        await updatePrunedStats();
        updateJsonInspector();
        updateMutationsTab();
        renderAiResponse(apiData.ai_message);

        showToast("Template updated successfully by AI!", "success");
      } catch (renderErr) {
        console.error("Error updating canvas after AI response:", renderErr);
        showToast("AI responded but canvas had a rendering issue.", "warning");
      }
    }

    setLoadingState(false);
  }

  // Local Simulation Engine fallback when backend key is missing
  function simulateLocalAiMutation(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const mutations = [];
    const layers = currentTemplate.layers || [];

    layers.forEach((layer) => {
      if (lowerPrompt.includes("headline") || lowerPrompt.includes("heading") || lowerPrompt.includes("title") || lowerPrompt.includes("text")) {
        if (layer.id === "main_headline" || layer.id === "main_title" || layer.id === "banner_text") {
          const match = prompt.match(/['"]([^'"]+)['"]/);
          if (match && match[1]) {
            layer.text = match[1];
            mutations.push({ layer_id: layer.id, tool: "update_text", new_value: layer.text });
          }
        }
      }

      if (lowerPrompt.includes("gold") || lowerPrompt.includes("yellow") || lowerPrompt.includes("blue") || lowerPrompt.includes("pink") || lowerPrompt.includes("purple") || lowerPrompt.includes("turquoise") || lowerPrompt.includes("black") || lowerPrompt.includes("white") || lowerPrompt.includes("cyan")) {
        let newColor = "#f59e0b";
        if (lowerPrompt.includes("black")) newColor = "#000000";
        else if (lowerPrompt.includes("white")) newColor = "#ffffff";
        else if (lowerPrompt.includes("cyan")) newColor = "#06b6d4";
        else if (lowerPrompt.includes("yellow") || lowerPrompt.includes("gold")) newColor = "#f59e0b";
        else if (lowerPrompt.includes("blue")) newColor = "#38bdf8";
        else if (lowerPrompt.includes("pink")) newColor = "#ec4899";
        else if (lowerPrompt.includes("purple")) newColor = "#a855f7";
        else if (lowerPrompt.includes("turquoise")) newColor = "#06b6d4";

        if (layer.type === "text" && (lowerPrompt.includes("heading") || lowerPrompt.includes("headline") || lowerPrompt.includes(layer.id))) {
          layer.color = newColor;
          mutations.push({ layer_id: layer.id, tool: "update_color", new_value: newColor });
        }
      }

      if (lowerPrompt.includes("add") && (lowerPrompt.includes("text") || lowerPrompt.includes("badge") || lowerPrompt.includes("element"))) {
        const match = prompt.match(/['"]([^'"]+)['"]/);
        const newTextVal = (match && match[1]) ? match[1] : "Special Offer";
        const newId = `text_element_${layers.length + 1}`;
        const newLayer = {
          id: newId,
          type: "text",
          x: 60,
          y: 350,
          width: 320,
          height: 44,
          text: newTextVal,
          fontSize: 20,
          fontWeight: 700,
          color: lowerPrompt.includes("green") ? "#10b981" : lowerPrompt.includes("pink") ? "#ec4899" : "#38bdf8",
          ai_label: `TextLayer (${newId})`
        };
        layers.push(newLayer);
        mutations.push({ layer_id: newId, tool: "add_new_text", new_value: `Created '${newTextVal}' at x:60, y:350` });
      }

      if (lowerPrompt.includes("background") || lowerPrompt.includes("dark")) {
        if (layer.type === "frame" || layer.id.includes("bg") || layer.id.includes("card")) {
          layer.backgroundColor = lowerPrompt.includes("purple") ? "#2e1065" : lowerPrompt.includes("blue") ? "#0f172a" : "#111827";
          mutations.push({ layer_id: layer.id, tool: "update_color", new_value: layer.backgroundColor });
        }
      }
    });


    if (mutations.length > 0) {
      appliedMutations.push(...mutations);
      renderCanvas();
      updatePrunedStats();
      updateJsonInspector();
      updateMutationsTab();
      const aiReply = `I've updated the template! Mutated ${mutations.length} property value(s).`;
      renderAiResponse(aiReply);
      appendChatMessage("assistant", aiReply);
      showToast(`Applied ${mutations.length} mutations to template.`, "success");
    } else {
      const fallbackReply = "I received your request. To make text edits, you can specify values inside quotes (e.g. 'FLASH SALE') or ask to change colors.";
      appendChatMessage("assistant", fallbackReply);
      showToast("AI message processed.", "success");
    }
  }

  // Render Visual Canvas
  function getNormalizedTemplate(template) {
    if (Array.isArray(template) && template.length > 0 && typeof template[0] === "object") {
      return template[0];
    }
    return template;
  }

  function renderCanvas() {
    const rootData = getNormalizedTemplate(currentTemplate);
    const canvasConfig = rootData.canvas || { width: 675, height: 675, backgroundColor: "#0f172a" };
    canvasFrame.style.width = canvasConfig.width + "px";
    canvasFrame.style.height = canvasConfig.height + "px";
    canvasFrame.style.backgroundColor = canvasConfig.backgroundColor || "#0f172a";

    document.getElementById("canvas-dimensions").textContent = `${canvasConfig.width} × ${canvasConfig.height} px`;
    document.getElementById("canvas-title").textContent = templateSelect.options[templateSelect.selectedIndex].text;

    canvasFrame.innerHTML = "";

    let layersList = [];
    if (Array.isArray(rootData.layers)) {
      layersList = rootData.layers;
    } else if (typeof rootData.layers === "object" && rootData.layers !== null) {
      layersList = Object.entries(rootData.layers).map(([id, layer]) => {
        return { id, ...layer };
      });
    }

    // Render ROOT canvas background image as a background element or full layer
    const rootLayer = rootData.layers?.["ROOT"];
    if (rootLayer && rootLayer.props?.image?.url) {
      const bgImgX = rootLayer.props.image.position?.x || rootLayer.props.position?.x || 0;
      const bgImgY = rootLayer.props.image.position?.y || rootLayer.props.position?.y || 0;
      const bgImgW = rootLayer.props.image.boxSize?.width || rootLayer.props.boxSize?.width || canvasConfig.width;
      const bgImgH = rootLayer.props.image.boxSize?.height || rootLayer.props.boxSize?.height || canvasConfig.height;

      const bgLayerEl = document.createElement("div");
      bgLayerEl.className = "canvas-layer root-bg-layer" + (isInspectMode ? " inspect-active" : "");
      bgLayerEl.id = "render-layer-ROOT-BG";
      bgLayerEl.style.left = bgImgX + "px";
      bgLayerEl.style.top = bgImgY + "px";
      bgLayerEl.style.width = bgImgW + "px";
      bgLayerEl.style.height = bgImgH + "px";
      bgLayerEl.style.zIndex = "0";
      bgLayerEl.style.backgroundImage = `url("${rootLayer.props.image.url}")`;
      bgLayerEl.style.backgroundSize = "cover";
      bgLayerEl.style.backgroundPosition = "center";
      bgLayerEl.style.border = "1px dashed rgba(255,255,255,0.2)";

      // Allow background image to be moved & resized!
      const rootBgObj = {
        id: "ROOT (Background Image)",
        type: "bgImage",
        x: bgImgX,
        y: bgImgY,
        width: bgImgW,
        height: bgImgH,
        props: rootLayer.props.image
      };
      makeLayerDraggable(bgLayerEl, rootBgObj);
      attachResizeHandles(bgLayerEl, rootBgObj);

      bgLayerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".canvas-layer").forEach((l) => l.classList.remove("selected"));
        bgLayerEl.classList.add("selected");
        renderSelectedLayerInspector(rootBgObj);
      });

      canvasFrame.appendChild(bgLayerEl);
    } else {
      canvasFrame.style.backgroundImage = "none";
    }

    layersList.forEach((layer) => {
      if (layer.id === "ROOT") return;

      const layerEl = document.createElement("div");
      layerEl.className = "canvas-layer" + (isInspectMode ? " inspect-active" : "");
      layerEl.id = `render-layer-${layer.id}`;

      // Coordinates resolution (position object inside props)
      const posX = layer.x !== undefined ? layer.x : (layer.props?.position?.x || 0);
      const posY = layer.y !== undefined ? layer.y : (layer.props?.position?.y || 0);
      const width = layer.width !== undefined ? layer.width : (layer.props?.boxSize?.width || 200);
      const height = layer.height !== undefined ? layer.height : (layer.props?.boxSize?.height || 50);

      layerEl.style.left = posX + "px";
      layerEl.style.top = posY + "px";
      layerEl.style.width = width + "px";
      layerEl.style.height = height + "px";

      const resolvedTypeName = typeof layer.type === "object" ? layer.type?.resolvedName : layer.type;

      if (layer.backgroundColor) {
        layerEl.style.backgroundColor = layer.backgroundColor;
      }
      if (layer.borderRadius) {
        layerEl.style.borderRadius = layer.borderRadius + "px";
      }

      if (resolvedTypeName === "TextLayer" || layer.type === "text") {
        let textContent = layer.text;
        let textColor = layer.color;
        let fontSize = layer.fontSize;
        let scale = layer.props?.scale || 1.0;
        let textTransform = "none";
        let textAlign = "left";

        // LidoJS doc content extraction
        try {
          const docContent = layer.props?.doc?.content?.[0];
          if (docContent) {
            const attrs = docContent.attrs || {};
            if (!textColor && attrs.color) textColor = attrs.color;
            if (!fontSize && attrs.fontSize) fontSize = parseFloat(attrs.fontSize);
            if (attrs.textTransform) textTransform = attrs.textTransform;
            if (attrs.textAlign) textAlign = attrs.textAlign;

            if (!textContent && docContent.content?.[0]?.text) {
              textContent = docContent.content[0].text;
            }
          }
        } catch (e) {}

        if (!textContent) textContent = layer.type?.replacableText || layer.type?.fixedText || "";

        // Calculate scaled font size for LidoJS template accuracy
        const finalFontSize = fontSize ? (fontSize * scale) : 18;

        layerEl.textContent = textContent || "";
        layerEl.style.color = textColor || "rgb(109, 172, 206)";
        layerEl.style.fontSize = `${finalFontSize}px`;
        layerEl.style.fontWeight = "700";
        layerEl.style.fontFamily = "Roboto, sans-serif";
        layerEl.style.textAlign = textAlign;
        layerEl.style.textTransform = textTransform;
        layerEl.style.lineHeight = "1.1";
        layerEl.style.display = "flex";
        layerEl.style.alignItems = "center";
        layerEl.style.justifyContent = textAlign === "right" ? "flex-end" : (textAlign === "center" ? "center" : "flex-start");
      } else if (resolvedTypeName === "FrameLayer" && layer.props?.image?.url) {
        const imgEl = document.createElement("img");
        imgEl.src = layer.props.image.url;
        imgEl.style.width = "100%";
        imgEl.style.height = "100%";
        imgEl.style.objectFit = "contain";
        layerEl.appendChild(imgEl);
      }



      // Make moveable via mouse drag & resizable via corner handles
      makeLayerDraggable(layerEl, layer);
      attachResizeHandles(layerEl, layer);


      // Single click selects layer and displays live property edit controls
      layerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".canvas-layer").forEach((l) => l.classList.remove("selected"));
        layerEl.classList.add("selected");
        renderSelectedLayerInspector(layer);
      });

      // Double-click enables inline text editing
      layerEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (resolvedTypeName === "TextLayer" || layer.type === "text") {
          enableInlineTextEdit(layerEl, layer);
        }
      });

      canvasFrame.appendChild(layerEl);
    });
  }

  // Manual Add Text Layer function
  function manuallyAddTextLayer() {
    saveHistoryState();
    const rootData = getNormalizedTemplate(currentTemplate);
    let layers = rootData.layers;

    const layerId = `manual_text_${Date.now().toString().slice(-4)}`;
    const newTextVal = "New Editable Text";

    const newLayer = {
      id: layerId,
      type: "text",
      x: 80,
      y: 200,
      width: 300,
      height: 48,
      text: newTextVal,
      fontSize: 24,
      fontWeight: 700,
      color: "#6366f1",
      ai_label: `TextLayer (${layerId})`
    };

    if (Array.isArray(layers)) {
      layers.push(newLayer);
    } else if (typeof layers === "object" && layers !== null) {
      layers[layerId] = newLayer;
    }

    renderCanvas();
    updateJsonInspector();
    updatePrunedStats();
    showToast("Added new manual text layer!", "success");
  }

  // Manual delete layer function
  function deleteLayerManually(layerId) {
    if (layerId === "ROOT" || layerId === "bg_accent" || layerId === "bg_card") {
      showToast("Cannot delete root background layer.", "error");
      return;
    }

    saveHistoryState();
    const rootData = getNormalizedTemplate(currentTemplate);
    let layers = rootData.layers;

    if (Array.isArray(layers)) {
      rootData.layers = layers.filter((l) => l.id !== layerId);
    } else if (typeof layers === "object" && layers !== null) {
      delete layers[layerId];
    }

    renderCanvas();
    updateJsonInspector();
    updatePrunedStats();

    selectedLayerInfo.innerHTML = `
      <span class="layer-name-badge">Canvas Background</span>
      <span class="layer-prop-item">Click any layer or double-click text to edit manually</span>
    `;

    showToast(`Deleted layer '${layerId}'`, "success");
  }

  // Keyboard shortcut listener for Undo/Redo & Delete/Backspace key
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (isCmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }

    if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
      e.preventDefault();
      redo();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      const selectedEl = document.querySelector(".canvas-layer.selected");
      if (selectedEl) {
        const layerId = selectedEl.id.replace("render-layer-", "");
        deleteLayerManually(layerId);
      }
    }
  });

  // Inline double-click text editing
  function enableInlineTextEdit(layerEl, layerObj) {

    layerEl.contentEditable = "true";
    layerEl.classList.add("inline-editing");
    layerEl.focus();

    const finishEdit = () => {
      layerEl.contentEditable = "false";
      layerEl.classList.remove("inline-editing");
      const updatedText = layerEl.textContent.trim();

      // Update text in object model
      layerObj.text = updatedText;
      if (layerObj.props?.doc?.content?.[0]?.content?.[0]) {
        layerObj.props.doc.content[0].content[0].text = updatedText;
      }
      if (layerObj.type && typeof layerObj.type === "object") {
        layerObj.type.replacableText = updatedText;
      }

      updateJsonInspector();
      updatePrunedStats();
      showToast("Updated text content manually!", "success");
    };

    layerEl.addEventListener("blur", finishEdit, { once: true });
    layerEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        layerEl.blur();
      }
    });
  }

  // Attach corner resize handle handles to element
  function attachResizeHandles(layerEl, layerObj) {
    if (layerObj.id === "bg_accent" || layerObj.id === "bg_card" || layerObj.id === "ROOT") return;

    const handleSe = document.createElement("div");
    handleSe.className = "resize-handle se";
    layerEl.appendChild(handleSe);

    handleSe.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      let startX = e.clientX;
      let startY = e.clientY;
      let startW = layerEl.offsetWidth;
      let startH = layerEl.offsetHeight;

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        const newW = Math.max(30, startW + dx);
        const newH = Math.max(20, startH + dy);

        layerObj.width = newW;
        layerObj.height = newH;
        if (layerObj.props?.boxSize) {
          layerObj.props.boxSize.width = newW;
          layerObj.props.boxSize.height = newH;
        }

        layerEl.style.width = newW + "px";
        layerEl.style.height = newH + "px";

        renderSelectedLayerInspector(layerObj);
        updateJsonInspector();
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        updatePrunedStats();
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  // Render bottom layer property bar with live edit inputs for text, size, color
  function renderSelectedLayerInspector(layer) {
    const isText = (layer.type === "text" || layer.type?.resolvedName === "TextLayer");
    let currentText = layer.text || layer.props?.doc?.content?.[0]?.content?.[0]?.text || layer.type?.replacableText || "";
    let currentColor = layer.color || layer.props?.doc?.content?.[0]?.attrs?.color || "#6366f1";
    const isRoot = (layer.id === "bg_accent" || layer.id === "bg_card" || layer.id === "ROOT");

    if (layer.id && !isRoot) {
      const shortText = currentText ? `("${currentText.length > 18 ? currentText.substring(0, 18) + '...' : currentText}")` : '';
      setTargetLayer(layer.id, `${layer.id} ${shortText}`);
    } else {
      clearTargetLayer();
    }

    selectedLayerInfo.innerHTML = `
      <span class="layer-name-badge">${layer.id}</span>
      <span class="layer-prop-item">Pos: [${layer.x !== undefined ? layer.x : (layer.props?.position?.x || 0)}, ${layer.y !== undefined ? layer.y : (layer.props?.position?.y || 0)}]</span>
      
      <div class="manual-edit-group">
        ${isText ? `
          <label style="font-size:0.75rem; color:var(--text-dim);">Text:</label>
          <input type="text" class="manual-input" id="inspector-text-input" value="${currentText.replace(/"/g, '&quot;')}" style="width:140px;" />
          
          <label style="font-size:0.75rem; color:var(--text-dim);">Font Size:</label>
          <input type="number" class="manual-input" id="inspector-size-input" value="${currentFontSize}" style="width:55px;" min="8" max="150" />
          
          <label style="font-size:0.75rem; color:var(--text-dim);">Color:</label>
          <input type="color" class="manual-input-color" id="inspector-color-input" value="${currentColor.startsWith('#') ? currentColor : '#6366f1'}" />
        ` : ''}

        <label style="font-size:0.75rem; color:var(--text-dim);">W:</label>
        <input type="number" class="manual-input" id="inspector-width-input" value="${currentWidth}" style="width:55px;" />
        <label style="font-size:0.75rem; color:var(--text-dim);">H:</label>
        <input type="number" class="manual-input" id="inspector-height-input" value="${currentHeight}" style="width:55px;" />

        ${!isRoot ? `
          <button class="btn btn-secondary btn-sm" id="inspector-delete-btn" style="color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.1); margin-left:6px;" title="Delete Selected Layer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete
          </button>
        ` : ''}
      </div>
    `;

    const deleteBtn = document.getElementById("inspector-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        deleteLayerManually(layer.id);
      });
    }


    const textInput = document.getElementById("inspector-text-input");
    if (textInput) {
      textInput.addEventListener("input", (e) => {
        const val = e.target.value;
        layer.text = val;
        if (layer.props?.doc?.content?.[0]?.content?.[0]) {
          layer.props.doc.content[0].content[0].text = val;
        }
        if (layer.type && typeof layer.type === "object") {
          layer.type.replacableText = val;
        }
        const domEl = document.getElementById(`render-layer-${layer.id}`);
        if (domEl) domEl.textContent = val;
        updateJsonInspector();
      });
    }

    const fontSizeInput = document.getElementById("inspector-size-input");
    if (fontSizeInput) {
      fontSizeInput.addEventListener("input", (e) => {
        const val = parseInt(e.target.value) || 20;
        layer.fontSize = val;
        if (layer.props?.doc?.content?.[0]?.attrs) {
          layer.props.doc.content[0].attrs.fontSize = `${val}px`;
        }
        const domEl = document.getElementById(`render-layer-${layer.id}`);
        if (domEl) domEl.style.fontSize = `${val}px`;
        updateJsonInspector();
      });
    }

    const colorInput = document.getElementById("inspector-color-input");
    if (colorInput) {
      colorInput.addEventListener("input", (e) => {
        const val = e.target.value;
        layer.color = val;
        if (layer.props?.doc?.content?.[0]?.attrs) {
          layer.props.doc.content[0].attrs.color = val;
        }
        const domEl = document.getElementById(`render-layer-${layer.id}`);
        if (domEl) domEl.style.color = val;
        updateJsonInspector();
      });
    }

    const widthInput = document.getElementById("inspector-width-input");
    if (widthInput) {
      widthInput.addEventListener("input", (e) => {
        const val = parseInt(e.target.value) || 50;
        layer.width = val;
        if (layer.props?.boxSize) layer.props.boxSize.width = val;
        const domEl = document.getElementById(`render-layer-${layer.id}`);
        if (domEl) domEl.style.width = `${val}px`;
        updateJsonInspector();
      });
    }

    const heightInput = document.getElementById("inspector-height-input");
    if (heightInput) {
      heightInput.addEventListener("input", (e) => {
        const val = parseInt(e.target.value) || 20;
        layer.height = val;
        if (layer.props?.boxSize) layer.props.boxSize.height = val;
        const domEl = document.getElementById(`render-layer-${layer.id}`);
        if (domEl) domEl.style.height = `${val}px`;
        updateJsonInspector();
      });
    }
  }



  // Mouse Drag and Drop Engine for Layers
  function makeLayerDraggable(layerEl, layerObj) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let preDragTemplateState = null;

    layerEl.style.cursor = "grab";

    layerEl.addEventListener("mousedown", (e) => {
      // Don't trigger drag on background frame if ROOT canvas
      if (layerObj.id === "bg_accent" || layerObj.id === "bg_card") return;

      isDragging = true;
      preDragTemplateState = JSON.parse(JSON.stringify(currentTemplate));
      layerEl.style.cursor = "grabbing";
      startX = e.clientX;
      startY = e.clientY;
      // Resolve position coordinates for LidoJS format vs standard format
      initialLeft = layerObj.x !== undefined ? layerObj.x : (layerObj.props?.position?.x || 0);
      initialTop = layerObj.y !== undefined ? layerObj.y : (layerObj.props?.position?.y || 0);

      document.querySelectorAll(".canvas-layer").forEach((l) => l.classList.remove("selected"));
      layerEl.classList.add("selected");
      e.stopPropagation();

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        const newX = Math.round(initialLeft + dx);
        const newY = Math.round(initialTop + dy);

        layerObj.x = newX;
        layerObj.y = newY;
        if (layerObj.props?.position) {
          layerObj.props.position.x = newX;
          layerObj.props.position.y = newY;
        }

        layerEl.style.left = newX + "px";
        layerEl.style.top = newY + "px";

        selectedLayerInfo.innerHTML = `
          <span class="layer-name-badge">${layerObj.id} (${layerObj.type})</span>
          <span class="layer-prop-item">Pos: [${newX}, ${newY}] | Dim: ${layerObj.width}×${layerObj.height}</span>
          ${layerObj.color ? `<span class="layer-prop-item">Color: <strong style="color:${layerObj.color}">${layerObj.color}</strong></span>` : ''}
        `;
      };

      const onMouseUp = (upEvent) => {
        if (isDragging) {
          isDragging = false;
          layerEl.style.cursor = "grab";
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);

          const dx = upEvent.clientX - startX;
          const dy = upEvent.clientY - startY;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            // Push preDrag state to undo stack
            if (preDragTemplateState) {
              undoStack.push(preDragTemplateState);
              if (undoStack.length > MAX_HISTORY_LIMIT) undoStack.shift();
              redoStack = [];
              updateHistoryButtons();
            }
          }

          // Update Inspector and stats
          updateJsonInspector();
          updatePrunedStats();
        }
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }


  // Update Pruned Stats
  async function updatePrunedStats() {
    const rawJsonStr = JSON.stringify(currentTemplate, null, 2);
    const rawBytes = new Blob([rawJsonStr]).size;
    origSizeVal.textContent = formatBytes(rawBytes);

    try {
      const response = await fetch("/api/ai/prune-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_json: currentTemplate })
      });

      if (response.ok) {
        const data = await response.json();
        originalPrunedContext = data.pruned_context;
        const prunedBytes = new Blob([JSON.stringify(data.pruned_context)]).size;
        prunedSizeVal.textContent = formatBytes(prunedBytes);

        const reduction = Math.round(((rawBytes - prunedBytes) / rawBytes) * 100);
        savingsBar.style.width = `${Math.max(10, reduction)}%`;
        savingsText.textContent = `${reduction}% payload token reduction for AI`;
      }
    } catch (e) {
      console.warn("Failed to prune context via backend API:", e);
    }
  }

  // Update JSON Code Box
  function updateJsonInspector() {
    if (activeJsonSubtab === "full") {
      jsonDisplay.textContent = JSON.stringify(currentTemplate, null, 2);
    } else {
      jsonDisplay.textContent = JSON.stringify(originalPrunedContext || currentTemplate, null, 2);
    }
  }

  // Update Mutations Audit Tab
  function updateMutationsTab() {
    mutationCountBadge.textContent = appliedMutations.length;

    if (appliedMutations.length === 0) {
      mutationsTimeline.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          <p>No mutations applied yet.</p>
          <span>Type an AI prompt on the left to edit template properties.</span>
        </div>
      `;
      return;
    }

    mutationsTimeline.innerHTML = appliedMutations.map((m, idx) => `
      <div class="mutation-card">
        <div class="mutation-header">
          <span class="mutation-layer">#${idx + 1} Target: ${m.layer_id || "Layer"}</span>
          <span class="mutation-tool">${m.tool || "mutation"}</span>
        </div>
        <div class="mutation-detail">
          Value set to: <span class="val-badge">${m.new_value || m.text || m.color || JSON.stringify(m)}</span>
        </div>
      </div>
    `).join("");
  }

  // Render AI Response Message
  function renderAiResponse(msg) {
    aiResponseBox.innerHTML = `
      <div class="ai-msg">
        <div style="font-weight: 700; color: var(--accent-purple); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
          LangGraph Agent Loop Summary
        </div>
        <p>${msg}</p>
      </div>
    `;
  }

  // Helper Utils
  function setLoadingState(isLoading) {
    submitPromptBtn.disabled = isLoading;
    if (isLoading) {
      document.querySelector(".btn-text").textContent = "Processing...";
      document.querySelector(".sparkle-icon").classList.add("hidden");
      document.getElementById("btn-spinner").classList.remove("hidden");
    } else {
      document.querySelector(".btn-text").textContent = "Send";
      document.querySelector(".sparkle-icon").classList.remove("hidden");
      document.getElementById("btn-spinner").classList.add("hidden");
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function showToast(message, type = "success") {
    const toastContainer = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
});
