"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/main/typescript/capabilities.ts
  var capabilities;
  var init_capabilities = __esm({
    "src/main/typescript/capabilities.ts"() {
      "use strict";
      capabilities = {
        /**
         * Whether to include the code highlighter document handler for syntax highlighting in code blocks.
         * @see CodeHighlighter
         */
        code: false,
        /**
         * Whether to include the math document handler for rendering mathematical formulas.
         * @see MathRenderer
         */
        math: false,
        /**
         * Whether to include the Mermaid diagram document handler for rendering diagrams.
         * @see DiagramRenderer
         */
        mermaid: false
      };
    }
  });

  // src/main/typescript/queue/async-execution-queue.ts
  var AsyncExecutionQueue;
  var init_async_execution_queue = __esm({
    "src/main/typescript/queue/async-execution-queue.ts"() {
      "use strict";
      AsyncExecutionQueue = class {
        constructor() {
          /** Array of async functions waiting to be executed */
          this.queue = [];
          /** Callback function executed after all queued functions complete */
          this.onComplete = [];
          /** Flag indicating whether the queue has been executed and completed */
          this.completed = false;
        }
        /**
         * Adds an asynchronous function to the execution queue.
         *
         * @param fn - An async function that returns a Promise<void> to be executed later
         */
        pushAsync(fn) {
          this.queue.push(fn);
        }
        /**
         * Adds a synchronous function to the execution queue.
         *
         * This method wraps the provided synchronous function in an async function
         * that returns a resolved Promise, allowing it to be executed in the same
         * manner as other async functions in the queue.
         *
         * @param fn - A synchronous function to be executed later
         */
        push(fn) {
          this.queue.push(async () => fn());
        }
        /**
         * Registers a callback to be called after all queued functions have executed.
         *
         * @param fn - A function to be called once after `execute()` completes
         */
        addOnComplete(fn) {
          this.onComplete.push(fn);
        }
        /**
         * Executes all queued functions in parallel and clears the queue.
         *
         * This method uses Promise.all() to run all queued functions concurrently,
         * waits for all of them to complete, then clears the queue and calls the
         * onExecute callback. After execution, the queue is marked as completed.
         *
         * @returns A Promise that resolves when all queued functions have completed
         */
        async execute() {
          await Promise.all(this.queue.map(async (fn) => fn()));
          this.queue = [];
          this.onComplete?.forEach((fn) => fn());
          this.completed = true;
        }
        /**
         * Checks whether the queue has been executed and completed.
         *
         * @returns true if `execute()` has been called and completed, false otherwise
         */
        isCompleted() {
          return this.completed;
        }
      };
    }
  });

  // src/main/typescript/queue/execution-queues.ts
  var preRenderingExecutionQueue, postRenderingExecutionQueue;
  var init_execution_queues = __esm({
    "src/main/typescript/queue/execution-queues.ts"() {
      "use strict";
      init_async_execution_queue();
      preRenderingExecutionQueue = new AsyncExecutionQueue();
      postRenderingExecutionQueue = new AsyncExecutionQueue();
    }
  });

  // src/main/typescript/document/document-handler.ts
  function filterConditionalHandlers(handlers) {
    return handlers.filter((handler) => handler instanceof DocumentHandler);
  }
  var DocumentHandler;
  var init_document_handler = __esm({
    "src/main/typescript/document/document-handler.ts"() {
      "use strict";
      init_execution_queues();
      DocumentHandler = class {
        /**
         * @param quarkdownDocument - The document instance this handler manages
         */
        constructor(quarkdownDocument) {
          this.quarkdownDocument = quarkdownDocument;
        }
        /**
         * Pushes this handler's lifecycle methods to the appropriate execution queues.
         * Pre-rendering handlers are added to the pre-rendering queue,
         * post-rendering handlers are added to the post-rendering queue.
         */
        pushToQueue() {
          this.init?.();
          if (this.onPreRendering) {
            preRenderingExecutionQueue.pushAsync(() => this.onPreRendering());
          }
          if (this.onPostRendering) {
            postRenderingExecutionQueue.pushAsync(() => this.onPostRendering());
          }
        }
      };
    }
  });

  // src/main/typescript/sidebar/sidebar.ts
  function createSidebarContainer() {
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    sidebar.style.position = "fixed";
    return sidebar;
  }
  function createSidebarList() {
    return document.createElement("ol");
  }
  function createNavigationItem(header) {
    const listItem = document.createElement("li");
    listItem.className = header.tagName.toLowerCase();
    listItem.innerHTML = `<a href="#${header.id}"><span>${header.textContent}</span></a>`;
    return listItem;
  }
  function createActiveStateChecker(header, listItem, getCurrentActiveItem, setCurrentActiveItem) {
    return function checkForActive() {
      const rect = header.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.5 && rect.top + rect.height >= 0) {
        const currentActive = getCurrentActiveItem();
        currentActive?.classList.remove("active");
        setCurrentActiveItem(listItem);
        listItem.classList.add("active");
      }
    };
  }
  function getHeadings() {
    const selection = document.querySelectorAll("h1, h2, h3");
    return Array.from(selection).filter((header) => !header.hasAttribute("data-decorative"));
  }
  function populateNavigationItems(sidebarList) {
    let currentActiveListItem = null;
    const getCurrentActiveItem = () => currentActiveListItem;
    const setCurrentActiveItem = (item) => {
      currentActiveListItem = item;
    };
    getHeadings().forEach((header) => {
      const listItem = createNavigationItem(header);
      sidebarList.appendChild(listItem);
      const checkForActive = createActiveStateChecker(
        header,
        listItem,
        getCurrentActiveItem,
        setCurrentActiveItem
      );
      checkForActive();
      window.addEventListener("scroll", checkForActive);
    });
  }
  function attachSidebarToDocument(sidebar) {
    document.body.appendChild(sidebar);
  }
  function createSidebar() {
    const sidebar = createSidebarContainer();
    const sidebarList = createSidebarList();
    populateNavigationItems(sidebarList);
    sidebar.appendChild(sidebarList);
    attachSidebarToDocument(sidebar);
    return sidebar;
  }
  var init_sidebar = __esm({
    "src/main/typescript/sidebar/sidebar.ts"() {
      "use strict";
    }
  });

  // src/main/typescript/document/handlers/sidebar.ts
  var Sidebar;
  var init_sidebar2 = __esm({
    "src/main/typescript/document/handlers/sidebar.ts"() {
      "use strict";
      init_document_handler();
      init_sidebar();
      Sidebar = class extends DocumentHandler {
        async onPostRendering() {
          createSidebar();
        }
      };
    }
  });

  // src/main/typescript/footnotes/footnote-lookup.ts
  function getFootnoteDefinitions(sorted) {
    const definitions = Array.from(document.querySelectorAll(".footnote-definition"));
    if (!sorted) {
      return definitions;
    }
    return definitions.sort((a, b) => {
      const indexA = parseInt(a.dataset.footnoteIndex || "0");
      const indexB = parseInt(b.dataset.footnoteIndex || "0");
      return indexA - indexB;
    });
  }
  function getFootnoteFirstReference(definitionId) {
    return document.querySelector(`.footnote-reference[data-definition="${definitionId}"]`);
  }
  function getFootnoteDefinitionsAndFirstReference(sorted = true) {
    const definitions = getFootnoteDefinitions(sorted);
    return definitions.map((definition) => {
      const reference = getFootnoteFirstReference(definition.id);
      return reference ? { reference, definition } : null;
    }).filter((item) => item !== null);
  }
  var init_footnote_lookup = __esm({
    "src/main/typescript/footnotes/footnote-lookup.ts"() {
      "use strict";
    }
  });

  // src/main/typescript/document/handlers/footnotes/footnotes-document-handler.ts
  var FootnotesDocumentHandler;
  var init_footnotes_document_handler = __esm({
    "src/main/typescript/document/handlers/footnotes/footnotes-document-handler.ts"() {
      "use strict";
      init_document_handler();
      init_footnote_lookup();
      FootnotesDocumentHandler = class extends DocumentHandler {
        constructor() {
          super(...arguments);
          /** Footnote pairs (reference + definition) collected during pre-rendering. */
          this.footnotes = [];
        }
        async onPreRendering() {
          this.footnotes = getFootnoteDefinitionsAndFirstReference();
        }
      };
    }
  });

  // src/main/typescript/document/handlers/footnotes/footnotes-plain.ts
  var FootnotesPlain;
  var init_footnotes_plain = __esm({
    "src/main/typescript/document/handlers/footnotes/footnotes-plain.ts"() {
      "use strict";
      init_plain_document();
      init_footnotes_document_handler();
      FootnotesPlain = class extends FootnotesDocumentHandler {
        /** Sets up listener to re-render footnotes on resize. */
        init() {
          window.addEventListener("resize", () => this.onPostRendering?.());
        }
        /**
         * Calculates the bottom offset of the last definition in the margin area.
         * @param marginArea - The margin area containing footnote definitions
         * @returns The bottom offset in pixels, or the top of the margin area if empty
         */
        getLastDefinitionOffset(marginArea) {
          const lastChild = marginArea.lastElementChild;
          return lastChild ? lastChild.getBoundingClientRect().bottom : marginArea.getBoundingClientRect().top;
        }
        /**
         * Renders footnotes in the right margin area, positioned to align with their references.
         * Removes footnotes from their original locations and repositions them in the margin.
         */
        async onPostRendering() {
          const rightMarginArea = getRightMarginArea();
          if (!rightMarginArea) return;
          rightMarginArea.innerHTML = "";
          this.footnotes.forEach(({ reference, definition }) => {
            definition.remove();
            definition.style.marginTop = Math.max(
              0,
              reference.getBoundingClientRect().top - this.getLastDefinitionOffset(rightMarginArea)
            ) + "px";
            rightMarginArea.appendChild(definition);
          });
        }
      };
    }
  });

  // src/main/typescript/document/type/plain-document.ts
  function getRightMarginArea() {
    return document.querySelector("#margin-area-right");
  }
  var PlainDocument;
  var init_plain_document = __esm({
    "src/main/typescript/document/type/plain-document.ts"() {
      "use strict";
      init_sidebar2();
      init_execution_queues();
      init_footnotes_plain();
      PlainDocument = class {
        /**
         * @returns The document element
         */
        getParentViewport(_element) {
          return document.documentElement;
        }
        /** Sets up pre-rendering to execute when DOM content is loaded */
        setupPreRenderingHook() {
          document.addEventListener("DOMContentLoaded", async () => {
            await preRenderingExecutionQueue.execute();
          });
        }
        /** No post-rendering hook needed for plain documents */
        setupPostRenderingHook() {
        }
        /** Executes post-rendering queue since pre- and post-rendering overlap for plain documents */
        initializeRendering() {
          postRenderingExecutionQueue.execute().then();
        }
        getHandlers() {
          return [
            new Sidebar(this),
            new FootnotesPlain(this)
          ];
        }
      };
    }
  });

  // src/main/typescript/document/handlers/inline-collapsibles.ts
  var InlineCollapsibles;
  var init_inline_collapsibles = __esm({
    "src/main/typescript/document/handlers/inline-collapsibles.ts"() {
      "use strict";
      init_document_handler();
      InlineCollapsibles = class extends DocumentHandler {
        async onPostRendering() {
          const collapsibles = document.querySelectorAll(".inline-collapse");
          collapsibles.forEach((span) => {
            span.addEventListener("click", () => this.toggleCollapse(span));
          });
        }
        toggleCollapse(span) {
          const fullText = span.dataset.fullText;
          const collapsedText = span.dataset.collapsedText;
          const collapsed = span.dataset.collapsed === "true";
          const content = collapsed ? fullText : collapsedText;
          if (!content) return;
          span.dataset.collapsed = (!collapsed).toString();
          const isUserDefined = span.closest(".error") === null;
          if (isUserDefined) {
            span.innerHTML = content;
          } else {
            span.textContent = content;
          }
        }
      };
    }
  });

  // src/main/typescript/document/handlers/remaining-height.ts
  var RemainingHeight;
  var init_remaining_height = __esm({
    "src/main/typescript/document/handlers/remaining-height.ts"() {
      "use strict";
      init_document_handler();
      RemainingHeight = class extends DocumentHandler {
        async onPostRendering() {
          const fillHeightElements = document.querySelectorAll(".fill-height");
          fillHeightElements.forEach((element) => {
            const contentArea = this.quarkdownDocument.getParentViewport(element);
            if (!contentArea) return;
            const remainingHeight = contentArea.getBoundingClientRect().bottom - element.getBoundingClientRect().top;
            element.style.setProperty("--viewport-remaining-height", `${remainingHeight}px`);
          });
        }
      };
    }
  });

  // src/main/typescript/document/handlers/capabilities/math-renderer.ts
  var MathRenderer;
  var init_math_renderer = __esm({
    "src/main/typescript/document/handlers/capabilities/math-renderer.ts"() {
      "use strict";
      init_document_handler();
      MathRenderer = class extends DocumentHandler {
        async onPreRendering() {
          const texMacros = window.texMacros;
          const formulas = document.querySelectorAll("formula");
          formulas.forEach((formula) => {
            const content = formula.textContent;
            const isBlock = formula.dataset.block === "";
            if (!content) return;
            formula.innerHTML = katex.renderToString(content, {
              throwOnError: false,
              displayMode: isBlock,
              macros: texMacros || {}
            });
          });
        }
      };
    }
  });

  // src/main/typescript/document/handlers/capabilities/code-highlighter.ts
  var CodeHighlighter;
  var init_code_highlighter = __esm({
    "src/main/typescript/document/handlers/capabilities/code-highlighter.ts"() {
      "use strict";
      init_document_handler();
      CodeHighlighter = class extends DocumentHandler {
        init() {
          hljs.addPlugin(new CopyButtonPlugin());
        }
        async onPostRendering() {
          hljs.highlightAll();
          this.initLineNumbers();
          this.focusCodeLines();
        }
        /**
         * Adds line numbers to code blocks with the 'hljs' class, excluding those marked
         * with 'nohljsln' class.
         */
        initLineNumbers() {
          const codeBlocks = document.querySelectorAll("code.hljs:not(.nohljsln)");
          codeBlocks.forEach((code) => {
            hljs.lineNumbersBlockSync(code);
          });
        }
        /**
         * Applies visual focus to specific line ranges in code blocks.
         *
         * This method processes code blocks with the 'focus-lines' class and highlights
         * lines within the specified range using 'data-focus-start' and 'data-focus-end'
         * attributes. Supports open ranges where either start or end can be omitted.
         *
         * Range behavior:
         * - If start is NaN or missing: focuses from beginning up to end
         * - If end is NaN or missing: focuses from start to the last line
         * - If both are specified: focuses the exact range (inclusive)
         *
         * @example
         * ```html
         * <!-- Focus lines 5-10 -->
         * <code class="focus-lines" data-focus-start="5" data-focus-end="10">...</code>
         *
         * <!-- Focus from line 3 to end -->
         * <code class="focus-lines" data-focus-start="3">...</code>
         *
         * <!-- Focus from beginning to line 8 -->
         * <code class="focus-lines" data-focus-end="8">...</code>
         * ```
         */
        focusCodeLines() {
          const focusableCodeBlocks = document.querySelectorAll("code.focus-lines");
          focusableCodeBlocks.forEach((codeBlock) => {
            const focusRange = this.extractFocusRange(codeBlock);
            this.applyFocusToLines(codeBlock, focusRange);
          });
        }
        /**
         * Extracts the focus range from a code block's data attributes.
         *
         * @param codeBlock The code block element to extract range from
         * @returns An object containing the parsed start and end line numbers
         */
        extractFocusRange(codeBlock) {
          const start = parseInt(codeBlock.dataset.focusStart || "0");
          const end = parseInt(codeBlock.dataset.focusEnd || "0");
          return { start, end };
        }
        /**
         * Applies the 'focused' CSS class to lines within the specified range.
         *
         * @param codeBlock The code block containing the lines to focus
         * @param focusRange Object containing start and end line numbers
         */
        applyFocusToLines(codeBlock, focusRange) {
          const lines = codeBlock.querySelectorAll(".hljs-ln-line");
          lines.forEach((line) => {
            const lineNumber = parseInt(line.dataset.lineNumber || "0");
            if (this.isLineInFocusRange(lineNumber, focusRange)) {
              line.classList.add("focused");
            }
          });
        }
        /**
         * Determines if a line number falls within the focus range.
         *
         * Supports open ranges where NaN values indicate unbounded ranges:
         * - NaN start means focus from beginning
         * - NaN end means focus to the end
         *
         * @param lineNumber The line number to check
         * @param focusRange The focus range with start and end boundaries
         * @returns True if the line should be focused, false otherwise
         */
        isLineInFocusRange(lineNumber, focusRange) {
          const { start, end } = focusRange;
          const isAfterStart = isNaN(start) || lineNumber >= start;
          const isBeforeEnd = isNaN(end) || lineNumber <= end;
          return isAfterStart && isBeforeEnd;
        }
      };
    }
  });

  // src/main/typescript/util/hash.ts
  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }
  var init_hash = __esm({
    "src/main/typescript/util/hash.ts"() {
      "use strict";
    }
  });

  // src/main/typescript/document/handlers/capabilities/mermaid-renderer.ts
  var MermaidRenderer;
  var init_mermaid_renderer = __esm({
    "src/main/typescript/document/handlers/capabilities/mermaid-renderer.ts"() {
      "use strict";
      init_document_handler();
      init_hash();
      MermaidRenderer = class extends DocumentHandler {
        init() {
          mermaid.initialize({ startOnLoad: false });
        }
        /** Processes all Mermaid diagrams in the document. */
        async onPreRendering() {
          const diagrams = document.querySelectorAll(".mermaid:not([data-processed])");
          const renderPromises = Array.from(diagrams).map(
            (element) => this.loadFromCacheOrRender(element)
          );
          await Promise.all(renderPromises);
          this.realignDiagramContents();
        }
        /**
         * Renders a single Mermaid diagram element, using cached results when available.
         *
         * The caching mechanism uses session storage with a hash of the diagram content
         * as the key. This ensures that identical diagrams are only rendered once per
         * browser session, significantly improving performance for documents with
         * repeated or unchanged diagrams.
         *
         * @param element The HTML element containing the Mermaid diagram text
         */
        async loadFromCacheOrRender(element) {
          const code = element.textContent?.trim() || "";
          const id = "mermaid-" + hashCode(code);
          const cachedSvg = sessionStorage.getItem(id);
          element.dataset.processed = "true";
          if (cachedSvg) {
            console.debug("Using cached SVG for diagram:", id);
            element.innerHTML = cachedSvg;
            return;
          }
          console.debug("Rendering diagram:", id);
          const diagram = await mermaid.render(id, code, element);
          console.log(diagram);
          const svg = diagram.svg;
          element.innerHTML = svg;
          sessionStorage.setItem(id, svg);
        }
        /**
         * Calculates an appropriate scale percentage for a diagram based on its aspect ratio.
         *
         * Uses a scaling formula that considers the diagram's width-to-height ratio
         * to determine an optimal display size. Wider diagrams get larger scales while
         * taller diagrams are kept more compact.
         *
         * @param svg The SVG element containing the rendered diagram
         * @returns A percentage value (0-100) representing the optimal scale
         */
        calculateNewDiagramScale(svg) {
          const scaleFactor = 0.2;
          const scaleOffset = 0.4;
          const maxScale = 100;
          const width = svg.viewBox.baseVal.width || svg.clientWidth || 1;
          const height = svg.viewBox.baseVal.height || svg.clientHeight || 1;
          const aspectRatio = width / height;
          const scale = (scaleOffset + scaleFactor * aspectRatio) * maxScale;
          return Math.min(maxScale, scale);
        }
        /**
         * Applies styling adjustments to improve diagram presentation and alignment.
         */
        realignDiagramContents() {
          document.querySelectorAll(".mermaid").forEach((diagram) => {
            diagram.style.width = "100%";
            const svg = diagram.querySelector("svg");
            if (!svg) return;
            svg.style.width = this.calculateNewDiagramScale(svg) + "%";
          });
          document.querySelectorAll(".mermaid foreignObject").forEach((obj) => {
            obj.style.display = "grid";
          });
        }
      };
    }
  });

  // src/main/typescript/document/global-handlers.ts
  function getGlobalHandlers(document2) {
    return [
      new InlineCollapsibles(document2),
      new RemainingHeight(document2),
      capabilities.code && new CodeHighlighter(document2),
      capabilities.math && new MathRenderer(document2),
      capabilities.mermaid && new MermaidRenderer(document2)
    ];
  }
  var init_global_handlers = __esm({
    "src/main/typescript/document/global-handlers.ts"() {
      "use strict";
      init_capabilities();
      init_inline_collapsibles();
      init_remaining_height();
      init_math_renderer();
      init_code_highlighter();
      init_mermaid_renderer();
    }
  });

  // src/main/typescript/document/quarkdown-document.ts
  function prepare(document2) {
    const handlers = filterConditionalHandlers([...getGlobalHandlers(document2), ...document2.getHandlers()]);
    handlers.forEach((handler) => handler.pushToQueue());
    document2.setupPreRenderingHook();
    document2.setupPostRenderingHook();
    preRenderingExecutionQueue.addOnComplete(() => document2.initializeRendering());
  }
  var init_quarkdown_document = __esm({
    "src/main/typescript/document/quarkdown-document.ts"() {
      "use strict";
      init_document_handler();
      init_execution_queues();
      init_global_handlers();
    }
  });

  // src/main/typescript/live/live-preview.ts
  function notifyLivePreview(event, data = {}) {
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage(
        {
          source: MESSAGE_SOURCE,
          event,
          data,
          timestamp: Date.now()
        },
        TARGET_ORIGIN
      );
    } catch (e) {
      console.error("Failed to post message to parent", e);
    }
  }
  var MESSAGE_SOURCE, TARGET_ORIGIN;
  var init_live_preview = __esm({
    "src/main/typescript/live/live-preview.ts"() {
      "use strict";
      MESSAGE_SOURCE = "quarkdown";
      TARGET_ORIGIN = "*";
    }
  });

  // src/main/typescript/util/visibility.ts
  function isHidden(element) {
    return element.hasAttribute("data-hidden");
  }
  function isBlank(element) {
    return element.childNodes.length === 0 || Array.from(element.children).every((child) => isHidden(child));
  }
  var init_visibility = __esm({
    "src/main/typescript/util/visibility.ts"() {
      "use strict";
    }
  });

  // src/main/typescript/chunker/page-chunker.ts
  var PageChunker;
  var init_page_chunker = __esm({
    "src/main/typescript/chunker/page-chunker.ts"() {
      "use strict";
      init_visibility();
      PageChunker = class {
        /** Initializes the chunker with the container element to be chunked. */
        constructor(container) {
          this.chunks = [];
          this.container = container;
        }
        /**
         * Generates chunks based on the page break elements.
         * Page break elements are not preserved in the chunked output.
         * @param createElement Function that creates a new chunk element.
         */
        generateChunks(createElement) {
          const chunks = [];
          let currentChunk = createElement();
          Array.from(this.container.children).forEach((child) => {
            const el = child;
            if (el.className === "page-break") {
              chunks.push(currentChunk);
              currentChunk = createElement();
            } else {
              currentChunk.appendChild(child);
            }
          });
          if (currentChunk.childNodes.length > 0) {
            chunks.push(currentChunk);
          }
          this.chunks = chunks;
        }
        /** Applies the generated chunks to the container, replacing its content. */
        apply() {
          this.container.innerHTML = "";
          let queuedElements = [];
          this.chunks.forEach((chunk) => {
            if (isBlank(chunk)) {
              queuedElements.push(...Array.from(chunk.children));
            } else {
              if (queuedElements.length > 0) {
                queuedElements.forEach((element) => chunk.prepend(element));
                queuedElements = [];
              }
              this.container.appendChild(chunk);
            }
          });
          if (queuedElements.length > 0 && this.chunks.length > 0) {
            const last = this.container.lastElementChild;
            if (last) {
              queuedElements.forEach((element) => last.appendChild(element));
            }
            queuedElements = [];
          }
        }
        /**
         * Chunks the container into sections based on page breaks.
         * Page breaks are not preserved in the output, and empty chunks are ignored.
         * The container's content is replaced with the chunked sections.
         * @param chunkTagName The tag name to use for chunk elements (default is "section").
         */
        chunk(chunkTagName = "section") {
          const createElement = () => {
            const element = document.createElement(chunkTagName);
            element.className = "chunk";
            return element;
          };
          this.generateChunks(createElement);
          this.apply();
        }
      };
    }
  });

  // src/main/typescript/document/handlers/page-margins/page-margins-document-handler.ts
  var PageMarginsDocumentHandler;
  var init_page_margins_document_handler = __esm({
    "src/main/typescript/document/handlers/page-margins/page-margins-document-handler.ts"() {
      "use strict";
      init_document_handler();
      PageMarginsDocumentHandler = class extends DocumentHandler {
        /**
         * @param page The page or element to get initializers from
         * @return An array of page margin initializer elements within the given page
         */
        selectPageMarginInitializers(page) {
          return Array.from(page.querySelectorAll(".page-margin-content"));
        }
        /**
         * Collects all page margin content initializers and hides them from the document.
         * This prevents them from being displayed before proper positioning.
         */
        async onPreRendering() {
          this.selectPageMarginInitializers(document.body).forEach((initializer) => initializer.style.display = "none");
        }
        /**
         * Called after the main rendering process is complete,
         * this function is responsible for injecting page margin content
         * into the document at appropriate locations on each page.
         *
         * It processes each page, and stores active margin initializers.
         * Since #281, a page margin begins appearing from the page where the initializer is defined,
         * and continues to appear on subsequent pages unless overridden.
         */
        async onPostRendering() {
          const activeByPosition = /* @__PURE__ */ new Map();
          this.quarkdownDocument.getPages().forEach((page) => {
            const localInitializers = this.selectPageMarginInitializers(page);
            localInitializers.forEach((initializer) => {
              activeByPosition.set(initializer.className, initializer);
              initializer.remove();
            });
            activeByPosition.forEach((initializer) => {
              const marginPositionName = this.getMarginPositionName(initializer, page);
              if (marginPositionName) {
                this.apply(initializer, page, marginPositionName);
              }
            });
          });
        }
        /**
         * Gets the margin position name for the given page margin initializer, depending on whether the page is left or right.
         * @param initializer The page margin initializer element
         * @param page The page the margin will be applied to
         * @return The margin position name (e.g., "top-left", "bottom-center"), if defined
         */
        getMarginPositionName(initializer, page) {
          const pageType = this.quarkdownDocument.getPageType(page);
          return initializer.getAttribute(`data-on-${pageType}-page`);
        }
        /**
         * Copies the class list from the initializer to the target margin element,
         * adding the specific margin position class.
         * @param target The target margin element to which classes will be added
         * @param initializer The page margin initializer element
         * @param marginPositionName The margin position name (e.g., "top-left", "bottom-center")
         */
        pushMarginClassList(target, initializer, marginPositionName) {
          target.classList.add(
            `page-margin-${marginPositionName}`,
            ...initializer.classList
          );
        }
      };
    }
  });

  // src/main/typescript/document/handlers/page-margins/page-margins-slides.ts
  var PageMarginsSlides;
  var init_page_margins_slides = __esm({
    "src/main/typescript/document/handlers/page-margins/page-margins-slides.ts"() {
      "use strict";
      init_page_margins_document_handler();
      PageMarginsSlides = class extends PageMarginsDocumentHandler {
        /**
         * Copies all page margin initializers to the slide background.
         */
        apply(initializer, page, marginPositionName) {
          const pageMargin = document.createElement("div");
          this.pushMarginClassList(pageMargin, initializer, marginPositionName);
          pageMargin.innerHTML = initializer.innerHTML;
          page.background.appendChild(pageMargin);
        }
      };
    }
  });

  // src/main/typescript/footnotes/footnote-dom.ts
  function getOrCreateFootnoteRule(footnoteArea) {
    const footnoteRuleClassName = "footnote-rule";
    const existingRule = footnoteArea.querySelector(`.${footnoteRuleClassName}`);
    if (existingRule) return existingRule;
    const rule = document.createElement("div");
    rule.className = footnoteRuleClassName;
    footnoteArea.insertAdjacentElement("afterbegin", rule);
    return rule;
  }
  function getOrCreateFootnoteArea(page) {
    const className = "footnote-area";
    let footnoteArea = page.querySelector(`.${className}`);
    if (footnoteArea) return footnoteArea;
    footnoteArea = document.createElement("div");
    footnoteArea.className = className;
    page.appendChild(footnoteArea);
    getOrCreateFootnoteRule(footnoteArea);
    return footnoteArea;
  }
  var init_footnote_dom = __esm({
    "src/main/typescript/footnotes/footnote-dom.ts"() {
      "use strict";
    }
  });

  // src/main/typescript/document/handlers/footnotes/footnotes-slides.ts
  var FootnotesSlides;
  var init_footnotes_slides = __esm({
    "src/main/typescript/document/handlers/footnotes/footnotes-slides.ts"() {
      "use strict";
      init_footnote_dom();
      init_footnotes_document_handler();
      FootnotesSlides = class extends FootnotesDocumentHandler {
        async onPostRendering() {
          this.footnotes.forEach(({ reference, definition }) => {
            const page = this.quarkdownDocument.getParentViewport(reference);
            if (!page) return;
            definition.remove();
            getOrCreateFootnoteArea(page)?.appendChild(definition);
          });
        }
      };
    }
  });

  // src/main/typescript/util/id.ts
  function getAnchorTargetId(link) {
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#")) {
      return void 0;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      return void 0;
    }
    const id = decoded.slice(1);
    return id.length > 0 ? id : void 0;
  }
  var init_id = __esm({
    "src/main/typescript/util/id.ts"() {
      "use strict";
    }
  });

  // src/main/typescript/document/handlers/page-numbers.ts
  var PageNumbers;
  var init_page_numbers = __esm({
    "src/main/typescript/document/handlers/page-numbers.ts"() {
      "use strict";
      init_document_handler();
      init_id();
      PageNumbers = class extends DocumentHandler {
        /**
         * Gets all elements that display the total page count.
         * @returns NodeList of total page number elements (`.total-page-number`)
         */
        getTotalPageNumberElements() {
          return document.querySelectorAll(".total-page-number");
        }
        /**
         * Gets all elements that display the current page number.
         * @param page - The page element to search within
         * @returns NodeList of current page number elements (`.current-page-number`)
         */
        getCurrentPageNumberElements(page) {
          return page.querySelectorAll(".current-page-number");
        }
        /**
         * Finds all page number reset markers contained in the given page.
         */
        getPageNumberResetMarkers(page) {
          return Array.from(page.querySelectorAll(".page-number-reset"));
        }
        /**
         * Updates all total page number elements with the total count of pages.
         */
        updateTotalPageNumbers(pages) {
          const amount = pages.length;
          this.getTotalPageNumberElements().forEach((total) => {
            total.innerText = amount.toString();
          });
        }
        /**
         * Updates all current page number elements with their respective (possibly reset) page numbers.
         */
        updateCurrentPageNumbers(pages) {
          let pageNumber = 1;
          pages.forEach((page) => {
            const resetMarkers = this.getPageNumberResetMarkers(page);
            resetMarkers.forEach((marker) => {
              const requested = parseInt(marker.dataset.start || "1", 10);
              if (Number.isFinite(requested) && requested > 0) {
                pageNumber = requested;
              }
            });
            this.getCurrentPageNumberElements(page).forEach((pageNumberElement) => {
              pageNumberElement.innerText = pageNumber.toString();
              this.quarkdownDocument.setDisplayPageNumber(page, pageNumber);
            });
            pageNumber += 1;
          });
        }
        /**
         * Updates table of contents entries so they display the logical (reset-aware) page numbers.
         */
        updateTableOfContentsPageNumbers() {
          const tocs = document.querySelectorAll('nav[data-role="table-of-contents"]');
          tocs.forEach((nav) => {
            nav.querySelectorAll(':scope a[href^="#"]').forEach((anchor) => {
              const targetId = getAnchorTargetId(anchor);
              const target = targetId ? document.getElementById(targetId) : void 0;
              const displayNumber = target ? this.quarkdownDocument.getPageNumber(this.quarkdownDocument.getPage(target)) : void 0;
              this.setTableOfContentsPageNumber(anchor, displayNumber?.toString());
            });
          });
        }
        /**
         * Sets or updates the page number badge within a table of contents entry.
         * @param anchor - The anchor element representing the TOC entry
         * @param value - The page number to set (if undefined, the badge will be created but left empty)
         */
        setTableOfContentsPageNumber(anchor, value) {
          let badge = anchor.querySelector(".toc-page-number");
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "toc-page-number";
            anchor.appendChild(badge);
          }
          if (value) {
            badge.innerText = value;
          }
        }
        /**
         * Updates both total and current page numbers after rendering completes.
         */
        async onPostRendering() {
          const pages = this.quarkdownDocument.getPages();
          this.updateTotalPageNumbers(pages);
          this.updateCurrentPageNumbers(pages);
          this.updateTableOfContentsPageNumbers();
        }
      };
    }
  });

  // src/main/typescript/document/handlers/persistent-headings.ts
  var MIN_HEADING_LEVEL, MAX_HEADING_LEVEL, PersistentHeadings;
  var init_persistent_headings = __esm({
    "src/main/typescript/document/handlers/persistent-headings.ts"() {
      "use strict";
      init_document_handler();
      MIN_HEADING_LEVEL = 1;
      MAX_HEADING_LEVEL = 6;
      PersistentHeadings = class extends DocumentHandler {
        constructor() {
          super(...arguments);
          /**
           * Array storing the most recent heading HTML content at each depth level.
           * Index 0 corresponds to h1, index 1 to h2, etc.
           */
          this.lastHeadingPerDepth = [];
        }
        /**
         * Scans a page for headings (h1-h6) and updates the internal heading history.
         * Only the last heading of the highest level found is stored, and lower level headings are cleared.
         *
         * @example
         * If the container has:
         * ```html
         * <h2>Title</h2>
         * <h3>Subtitle</h3>
         * <h2>Another Title</h2>
         * ```
         *
         * Then after calling this method, `lastHeadingPerDepth` will be:
         * ```typescript
         * ["", "Another Title", "", "", "", ""] // h1 is empty, h2 is "Another Title", h3 has been cleared
         * ```
         *
         * @param page - The page to scan for headings
         */
        overwriteLastHeadings(page) {
          for (let depth = MIN_HEADING_LEVEL; depth <= MAX_HEADING_LEVEL; depth++) {
            const headings = page.querySelectorAll(`h${depth}:not([data-decorative])`);
            if (headings.length > 0) {
              this.lastHeadingPerDepth[depth - 1] = headings[headings.length - 1].innerHTML;
              this.lastHeadingPerDepth.length = depth;
            }
          }
        }
        /**
         * Applies the stored heading content to elements with the `.last-heading` class
         * within the specified containers. The heading content is determined by the
         * `data-depth` attribute on each `.last-heading` element.
         * @param page - The page containing `.last-heading` elements to update
         */
        applyLastHeadings(page) {
          const lastHeadingElements = page.querySelectorAll(".last-heading");
          lastHeadingElements.forEach((lastHeading) => {
            const depth = parseInt(lastHeading.dataset.depth || "0");
            lastHeading.innerHTML = this.lastHeadingPerDepth[depth - 1] || "";
          });
        }
        async onPostRendering() {
          const pages = this.quarkdownDocument.getPages();
          pages.forEach((page) => {
            this.overwriteLastHeadings(page);
            this.applyLastHeadings(page);
          });
        }
      };
    }
  });

  // src/main/typescript/document/type/slides-document.ts
  var SLIDE_SELECTOR, BACKGROUND_SELECTOR, SlidesDocument;
  var init_slides_document = __esm({
    "src/main/typescript/document/type/slides-document.ts"() {
      "use strict";
      init_execution_queues();
      init_page_chunker();
      init_page_margins_slides();
      init_footnotes_slides();
      init_page_numbers();
      init_persistent_headings();
      SLIDE_SELECTOR = ".reveal .slides > :is(section, .pdf-page)";
      BACKGROUND_SELECTOR = ".reveal :is(.backgrounds, .slides > .pdf-page) > .slide-background";
      SlidesDocument = class {
        /**
         * Retrieves a configuration property from the global configuration (`slidesConfig`).
         * Configuration is injected by Quarkdown's `.slides` function.
         */
        getConfigProperty(property, defaultValue) {
          const config = window.slidesConfig || {};
          return config[property] ?? defaultValue;
        }
        /**
         * @returns The parent slide element of the given element.
         */
        getParentViewport(element) {
          return element.closest(SLIDE_SELECTOR) || void 0;
        }
        getPages() {
          const slides = document.querySelectorAll(SLIDE_SELECTOR);
          const backgrounds = document.querySelectorAll(BACKGROUND_SELECTOR);
          if (!slides || !backgrounds) return [];
          return Array.from(slides).map((slide, index) => {
            const background = backgrounds[index];
            return {
              slide,
              background: background || document.createElement("div"),
              // Fallback for missing background
              querySelectorAll(query) {
                const slideResults = slide.querySelectorAll(query);
                const bgResults = background?.querySelectorAll(query) || [];
                return [...slideResults, ...Array.from(bgResults)];
              }
            };
          });
        }
        getPageNumber(page, includeDisplayNumbers = true) {
          const slide = page.slide;
          const displayNumber = includeDisplayNumbers ? slide.dataset.displayPageNumber : void 0;
          if (displayNumber) {
            return parseInt(displayNumber, 10);
          }
          if (!slide.parentElement) return 0;
          const index = Array.from(slide.parentElement.children).indexOf(slide);
          return index + 1;
        }
        getPageType(page) {
          const pageNumber = this.getPageNumber(page, false);
          return pageNumber % 2 === 0 ? "left" : "right";
        }
        getPage(element) {
          return this.getPages().find((page) => page.slide === this.getParentViewport(element));
        }
        setDisplayPageNumber(page, pageNumber) {
          page.slide.setAttribute("data-display-page-number", pageNumber.toString());
        }
        /** Sets up pre-rendering to execute when DOM content is loaded */
        setupPreRenderingHook() {
          document.addEventListener("DOMContentLoaded", async () => await preRenderingExecutionQueue.execute());
        }
        /** Sets up post-rendering to execute when Reveal.js is ready */
        setupPostRenderingHook() {
          Reveal.addEventListener("ready", () => {
            if (Reveal.isPrintView()) {
              Reveal.addEventListener("pdf-ready", () => postRenderingExecutionQueue.execute());
            } else {
              postRenderingExecutionQueue.execute().then();
            }
          });
        }
        /** Chunks content into slides and initializes Reveal.js */
        initializeRendering() {
          const slidesDiv = document.querySelector(".reveal .slides");
          if (!slidesDiv) return;
          new PageChunker(slidesDiv).chunk();
          Reveal.initialize({
            // If the center property is not explicitly set, it defaults to true unless the `--reveal-center-vertically` CSS variable of `:root` is set to `false`.
            center: this.getConfigProperty(
              "center",
              getComputedStyle(document.documentElement).getPropertyValue("--reveal-center-vertically") !== "false"
            ),
            controls: this.getConfigProperty("showControls", true),
            showNotes: this.getConfigProperty("showNotes", false),
            transition: this.getConfigProperty("transitionStyle", "slide"),
            transitionSpeed: this.getConfigProperty("transitionSpeed", "default"),
            hash: true,
            plugins: [RevealNotes]
          }).then();
        }
        getHandlers() {
          return [
            new PageMarginsSlides(this),
            new PageNumbers(this),
            new PersistentHeadings(this),
            new FootnotesSlides(this)
          ];
        }
      };
    }
  });

  // src/main/typescript/document/handlers/page-margins/page-margins-paged.ts
  var PageMarginsPaged;
  var init_page_margins_paged = __esm({
    "src/main/typescript/document/handlers/page-margins/page-margins-paged.ts"() {
      "use strict";
      init_page_margins_document_handler();
      PageMarginsPaged = class extends PageMarginsDocumentHandler {
        apply(initializer, page, marginPositionName) {
          const pageMargins = page.querySelectorAll(`.pagedjs_margin-${marginPositionName}`);
          pageMargins.forEach((pageMargin) => {
            pageMargin.classList.add("hasContent");
            const container = pageMargin.querySelector(".pagedjs_margin-content");
            if (!container) return;
            this.pushMarginClassList(container, initializer, marginPositionName);
            container.innerHTML = initializer.innerHTML;
          });
        }
      };
    }
  });

  // src/main/typescript/document/handlers/footnotes/footnotes-paged.ts
  var FootnotesPaged;
  var init_footnotes_paged = __esm({
    "src/main/typescript/document/handlers/footnotes/footnotes-paged.ts"() {
      "use strict";
      init_footnote_dom();
      init_footnotes_document_handler();
      FootnotesPaged = class extends FootnotesDocumentHandler {
        /**
         * This is a hacky workaround for the base paged.js behavior:
         * Any change made after the pagination is done will not be processed by paged.js,
         * hence adding new content (footnotes) will cause content to overflow.
         *
         * This function takes all footnote references and creates a virtual empty space
         * of the size of the footnote definition, reserving space for it.
         * After rendering, `handleFootnotes` will remove this space and place
         * the footnote definition in the footnote area, balancing the layout.
         */
        async onPreRendering() {
          await super.onPreRendering();
          this.footnotes.forEach(({ reference, definition }) => {
            reference.style.display = "block";
            reference.style.height = definition.scrollHeight + "px";
            definition.remove();
            document.body.appendChild(definition);
          });
        }
        /**
         * Moves footnote definitions to their respective footnote areas,
         * and adjusts the layout accordingly.
         *
         * Useful context: https://github.com/pagedjs/pagedjs/issues/292
         */
        async onPostRendering() {
          await super.onPreRendering();
          this.footnotes.forEach(({ reference, definition }) => {
            const pageArea = this.quarkdownDocument.getParentViewport(reference);
            console.log(document);
            if (!pageArea) return;
            const footnoteArea = pageArea.querySelector(".pagedjs_footnote_area > .pagedjs_footnote_content");
            if (!footnoteArea) return;
            const footnoteContent = footnoteArea.querySelector(".pagedjs_footnote_inner_content");
            if (!footnoteContent) return;
            definition.remove();
            footnoteContent.appendChild(definition);
            footnoteArea.classList.remove("pagedjs_footnote_empty");
            footnoteContent.style.columnWidth = "auto";
            pageArea.style.setProperty("--pagedjs-footnotes-height", `${footnoteArea.scrollHeight}px`);
            reference.style.height = "auto";
            reference.style.display = "inline";
            getOrCreateFootnoteRule(footnoteContent);
          });
        }
      };
    }
  });

  // src/main/typescript/document/handlers/paged/split-code-blocks-fix-paged.ts
  var SplitCodeBlocksFixPaged;
  var init_split_code_blocks_fix_paged = __esm({
    "src/main/typescript/document/handlers/paged/split-code-blocks-fix-paged.ts"() {
      "use strict";
      init_document_handler();
      SplitCodeBlocksFixPaged = class extends DocumentHandler {
        /**
         * Identifies and returns all code blocks that were split due to page breaks.
         *
         * Split code blocks are identified by the presence of a `data-split-from` attribute,
         * which contains the `data-ref` value of the original code block they were split from.
         *
         * @returns An array of split code block pairs, each containing the original block and its split counterpart
         */
        getSplitCodeBlocks() {
          const splitCodeBlocks = [];
          document.querySelectorAll("code[data-split-from]").forEach((split) => {
            const fromRef = split.getAttribute("data-split-from");
            if (!fromRef) return splitCodeBlocks;
            const from = document.querySelector(`code[data-ref="${fromRef}"]`);
            if (!from) return splitCodeBlocks;
            splitCodeBlocks.push({ from, split });
          });
          return splitCodeBlocks;
        }
        /**
         * Fixes the indentation of the first line in split code blocks.
         *
         * When a code block is split, the first line of the split portion often loses
         * its proper indentation. This method extracts the indentation from the last
         * line of the original code block and applies it to the split block.
         *
         * @param splitCodeBlocks Array of split code block pairs to fix
         */
        fixSplitCodeBlockFirstLineIndentation(splitCodeBlocks) {
          splitCodeBlocks.forEach(({ from, split }) => {
            const fromLastLine = from.innerText.split("\n").pop();
            if (!fromLastLine) return;
            const indentation = fromLastLine.match(/\s*$/)?.[0] || "";
            split.innerHTML = indentation + split.innerHTML;
          });
        }
        /**
         * Corrects line numbers in split code blocks to continue from the original block.
         *
         * Split code blocks typically restart their line numbering from 1, but they should
         * continue the numbering sequence from where the original block left off. This method
         * finds the last line number in the original block and adjusts all line numbers
         * in the split block accordingly.
         *
         * @param splitCodeBlocks Array of split code block pairs to fix
         */
        fixSplitCodeBlockLineNumbers(splitCodeBlocks) {
          const lineNumberAttribute = "data-line-number";
          splitCodeBlocks.forEach(({ from, split }) => {
            const lines = from.querySelectorAll(`[${lineNumberAttribute}]`);
            const lastLineNumber = Array.from(lines).pop()?.getAttribute(lineNumberAttribute) || "0";
            split.querySelectorAll(`[${lineNumberAttribute}]`).forEach((line) => {
              const lineNumber = line.getAttribute(lineNumberAttribute);
              if (!lineNumber) return;
              line.setAttribute(lineNumberAttribute, (parseInt(lineNumber) + parseInt(lastLineNumber)).toString());
            });
          });
        }
        /**
         * Executes the split code block fixes after document rendering is complete.
         *
         * This method is called during the post-rendering phase and:
         * 1. Identifies all split code blocks in the document
         * 2. Fixes their line numbering immediately
         * 3. Schedules another line number fix after syntax highlighting completes
         *
         * The setTimeout is necessary because syntax highlighting may modify the DOM
         * after initial rendering, potentially affecting line number attributes.
         */
        async onPostRendering() {
          const splitCodeBlocks = this.getSplitCodeBlocks();
          this.fixSplitCodeBlockFirstLineIndentation(splitCodeBlocks);
          setTimeout(() => this.fixSplitCodeBlockLineNumbers(splitCodeBlocks), 0);
        }
      };
    }
  });

  // src/main/typescript/document/handlers/paged/column-count-paged.ts
  var ColumnCountPaged;
  var init_column_count_paged = __esm({
    "src/main/typescript/document/handlers/paged/column-count-paged.ts"() {
      "use strict";
      init_document_handler();
      ColumnCountPaged = class extends DocumentHandler {
        async onPostRendering() {
          const columnCount = getComputedStyle(document.body).getPropertyValue("--qd-column-count")?.trim();
          if (!columnCount || columnCount === "") return;
          document.querySelectorAll(".pagedjs_page_content > div").forEach((content) => {
            content.style.columnCount = columnCount;
          });
        }
      };
    }
  });

  // src/main/typescript/document/handlers/show-on-ready.ts
  var ShowOnReady;
  var init_show_on_ready = __esm({
    "src/main/typescript/document/handlers/show-on-ready.ts"() {
      "use strict";
      init_document_handler();
      ShowOnReady = class extends DocumentHandler {
        async onPreRendering() {
          document.body.style.opacity = "0";
        }
        async onPostRendering() {
          document.body.style.opacity = "1";
        }
      };
    }
  });

  // src/main/typescript/document/type/paged-document.ts
  var PagedDocument;
  var init_paged_document = __esm({
    "src/main/typescript/document/type/paged-document.ts"() {
      "use strict";
      init_execution_queues();
      init_sidebar2();
      init_page_margins_paged();
      init_footnotes_paged();
      init_split_code_blocks_fix_paged();
      init_column_count_paged();
      init_page_numbers();
      init_show_on_ready();
      init_persistent_headings();
      PagedDocument = class {
        /**
         * @returns The parent page of the given element.
         */
        getParentViewport(element) {
          return element.closest(".pagedjs_area") || void 0;
        }
        getPages() {
          return Array.from(document.querySelectorAll(".pagedjs_page"));
        }
        getPage(element) {
          return element.closest(".pagedjs_page") || void 0;
        }
        getPageNumber(page, includeDisplayNumbers = true) {
          console.log("Getting page number for page:", page.dataset);
          return parseInt(
            (includeDisplayNumbers ? page.dataset.displayPageNumber : void 0) ?? page.dataset.pageNumber ?? "0"
          );
        }
        getPageType(page) {
          return page.classList.contains("pagedjs_right_page") ? "right" : "left";
        }
        setDisplayPageNumber(page, pageNumber) {
          page.setAttribute("data-display-page-number", pageNumber.toString());
        }
        /** Sets up pre-rendering to execute when DOM content is loaded. */
        setupPreRenderingHook() {
          document.addEventListener("DOMContentLoaded", async () => await preRenderingExecutionQueue.execute());
        }
        /** Sets up post-rendering to execute when paged.js is ready. */
        setupPostRenderingHook() {
          class PagedAfterReadyHandler extends Paged.Handler {
            afterRendered() {
              postRenderingExecutionQueue.execute().then();
            }
          }
          Paged.registerHandlers(PagedAfterReadyHandler);
        }
        /** Initializes paged.js rendering. */
        initializeRendering() {
          window.PagedPolyfill?.preview().then();
        }
        getHandlers() {
          return [
            new Sidebar(this),
            new ShowOnReady(this),
            new PageMarginsPaged(this),
            new PageNumbers(this),
            new PersistentHeadings(this),
            new FootnotesPaged(this),
            new ColumnCountPaged(this),
            new SplitCodeBlocksFixPaged(this)
          ];
        }
      };
    }
  });

  // src/main/typescript/index.ts
  var require_index = __commonJS({
    "src/main/typescript/index.ts"() {
      init_capabilities();
      init_execution_queues();
      init_plain_document();
      init_quarkdown_document();
      init_live_preview();
      init_slides_document();
      init_paged_document();
      function isReady() {
        return preRenderingExecutionQueue.isCompleted() && postRenderingExecutionQueue.isCompleted();
      }
      postRenderingExecutionQueue.addOnComplete(() => notifyLivePreview("postRenderingCompleted"));
      var context = window;
      context.isReady = isReady;
      context.quarkdownCapabilities = capabilities;
      context.prepare = prepare;
      context.PlainDocument = PlainDocument;
      context.PagedDocument = PagedDocument;
      context.SlidesDocument = SlidesDocument;
    }
  });
  require_index();
})();
//# sourceMappingURL=quarkdown.js.map
