(function () {

  // ── DOM refs ──────────────────────────────────────────
  const resultEl = document.getElementById('result');
  const exprEl   = document.getElementById('expression');

  // ── State ─────────────────────────────────────────────
  let current           = '0';   // number on screen
  let prev              = null;  // first operand
  let operator          = null;  // pending operator
  let waitingForOperand = false; // next digit starts fresh
  let justCalculated    = false; // equals was just pressed

  // ── Display ───────────────────────────────────────────
  function updateDisplay(expr) {
    let display = current;

    // Switch to scientific notation for very large/small numbers
    if (!isNaN(parseFloat(current)) && isFinite(current)) {
      const num = parseFloat(current);
      if (Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-6 && num !== 0)) {
        display = num.toExponential(4);
      } else {
        // Add thousands separators to the integer part
        const parts = current.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        display = parts.join('.');
      }
    }

    // Shrink font for long numbers
    const len = display.length;
    resultEl.style.fontSize =
      len > 12 ? '22px' : len > 9 ? '30px' : len > 6 ? '36px' : '42px';

    resultEl.textContent = display;
    resultEl.classList.remove('error');

    if (expr !== undefined) exprEl.textContent = expr;
  }

  function flashResult() {
    resultEl.classList.add('flash');
    setTimeout(() => resultEl.classList.remove('flash'), 100);
  }

  function showError(msg) {
    resultEl.classList.add('error');
    resultEl.style.fontSize = '26px';
    resultEl.textContent    = msg;
    exprEl.textContent      = '';
    // Reset all state
    current = '0'; prev = null; operator = null;
    waitingForOperand = false; justCalculated = false;
  }

  // ── Core math ─────────────────────────────────────────
  function calculate(a, b, op) {
    a = parseFloat(a);
    b = parseFloat(b);
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? null : a / b;
    return b;
  }

  // Clean floating-point noise (0.1+0.2 → 0.3, not 0.30000000000004)
  function formatNum(n) {
    return parseFloat(n.toPrecision(12)).toString();
  }

  // ── Input handlers ────────────────────────────────────
  function inputNum(num) {
    if (current.length >= 16) return; // max digits

    if (waitingForOperand) {
      current = String(num);
      waitingForOperand = false;
    } else if (justCalculated) {
      current = String(num);
      exprEl.textContent = '';
      justCalculated = false;
    } else {
      current = current === '0' ? String(num) : current + num;
    }

    updateDisplay();
  }

  function inputDot() {
    if (waitingForOperand) {
      current = '0.';
      waitingForOperand = false;
      updateDisplay();
      return;
    }
    if (!current.includes('.')) {
      current += '.';
      updateDisplay();
    }
  }

  function inputOp(op) {
    // Chain: resolve any pending operation first
    if (operator && !waitingForOperand) {
      const result = calculate(prev, current, operator);
      if (result === null) { showError('Cannot divide by 0'); return; }
      const res = formatNum(result);
      exprEl.textContent = prev + ' ' + operator + ' ' + current + ' ' + op;
      prev    = res;
      current = res;
      updateDisplay();
    } else {
      exprEl.textContent = current + ' ' + op;
      prev = current;
    }
    operator          = op;
    waitingForOperand = true;
    justCalculated    = false;
  }

  function inputEq() {
    if (!operator || waitingForOperand) return;
    const result = calculate(prev, current, operator);
    if (result === null) { showError('Cannot divide by 0'); return; }
    const res = formatNum(result);
    exprEl.textContent = prev + ' ' + operator + ' ' + current + ' =';
    current           = res;
    prev              = null;
    operator          = null;
    waitingForOperand = false;
    justCalculated    = true;
    flashResult();
    updateDisplay();
  }

  function inputPct() {
    const n = parseFloat(current);
    current = prev && operator
      ? formatNum((parseFloat(prev) * n) / 100)
      : formatNum(n / 100);
    updateDisplay();
  }

  function clearAll() {
    current = '0'; prev = null; operator = null;
    waitingForOperand = false; justCalculated = false;
    updateDisplay('');
  }

  function clearEntry() {
    current = '0';
    waitingForOperand = false;
    updateDisplay();
  }

  function backspace() {
    if (waitingForOperand || justCalculated) return;
    current = current.length > 1 ? current.slice(0, -1) : '0';
    updateDisplay();
  }

  // ── Ripple effect ─────────────────────────────────────
  function createRipple(btn, e) {
    const span = document.createElement('span');
    span.classList.add('ripple');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    span.style.width  = size + 'px';
    span.style.height = size + 'px';
    span.style.left   = (e.clientX - rect.left  - size / 2) + 'px';
    span.style.top    = (e.clientY - rect.top   - size / 2) + 'px';
    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  }

  // ── Button click listener ─────────────────────────────
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      createRipple(this, e);
      const num = this.dataset.num;
      const op  = this.dataset.op;
      const act = this.dataset.action;

      if (num !== undefined)     inputNum(num);
      else if (op)               inputOp(op);
      else if (act === 'eq')     inputEq();
      else if (act === 'clear')  clearAll();
      else if (act === 'ce')     clearEntry();
      else if (act === 'dot')    inputDot();
      else if (act === 'pct')    inputPct();
    });
  });

  // ── Keyboard support ──────────────────────────────────
  const keyMap = {
    '0':'0','1':'1','2':'2','3':'3','4':'4',
    '5':'5','6':'6','7':'7','8':'8','9':'9',
    '+':'+', '-':'−', '*':'×', '/':'÷',
    'Enter':'eq', '=':'eq',
    'Escape':'clear', 'Backspace':'back',
    '.':'dot', '%':'pct'
  };

  document.addEventListener('keydown', function (e) {
    const mapped = keyMap[e.key];
    if (!mapped) return;
    e.preventDefault();

    // Flash the matching button visually
    let sel = null;
    if ('0123456789'.includes(mapped))      sel = `[data-num="${mapped}"]`;
    else if (['+','−','×','÷'].includes(mapped)) sel = `[data-op="${mapped}"]`;
    else if (mapped === 'eq')    sel = '[data-action="eq"]';
    else if (mapped === 'clear') sel = '[data-action="clear"]';
    else if (mapped === 'dot')   sel = '[data-action="dot"]';
    else if (mapped === 'pct')   sel = '[data-action="pct"]';

    if (sel) {
      const el = document.querySelector(sel);
      if (el) {
        el.classList.add('pressed');
        setTimeout(() => el.classList.remove('pressed'), 120);
      }
    }

    // Dispatch to the right function
    if ('0123456789'.includes(mapped)) inputNum(mapped);
    else if (mapped === '+')   inputOp('+');
    else if (mapped === '−')   inputOp('−');
    else if (mapped === '×')   inputOp('×');
    else if (mapped === '÷')   inputOp('÷');
    else if (mapped === 'eq')    inputEq();
    else if (mapped === 'clear') clearAll();
    else if (mapped === 'back')  backspace();
    else if (mapped === 'dot')   inputDot();
    else if (mapped === 'pct')   inputPct();
  });

  // ── Init ──────────────────────────────────────────────
  updateDisplay('');

})();