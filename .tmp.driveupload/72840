// ============================================================================
// utils/safeJsonLikeParser.js
// ------------------------------------------------------------------------
// [Security Hardening] بديل آمن لِـ Function(`return (...)`) اللي كان
// مستخدم في productController.js عشان يفهم قيم شبه-JSON جايه من العميل
// (مفاتيح من غير quotes، quotes مفردة، إلخ). الكود القديم كان بيشغّل أي
// جملة JavaScript يبعتها العميل (Remote Code Execution) لو فشل JSON.parse
// العادي والتنضيف بالـ regex.
//
// البديل ده parser صريح (recursive-descent) بيفهم subset من صيغة JSON5:
// objects, arrays, strings ('..' أو "..")، أرقام، true/false/null، ومفاتيح
// من غير quotes. مفيش تنفيذ كود إطلاقًا - أي توكن غير متوقع (زي استدعاء
// function، عمليات حسابية، `new`، إلخ) بيرمي خطأ ويرجع الاستدعاء الأصلي
// يعامله زي ما كان بيحصل قبل كده (fallback لل value الأصلية).
// ============================================================================

class SafeParseError extends Error {}

const isDigit = (ch) => ch >= '0' && ch <= '9';
const isIdentifierStart = (ch) => /[A-Za-z_$]/.test(ch);
const isIdentifierPart = (ch) => /[A-Za-z0-9_$]/.test(ch);

class SafeJsonLikeParser {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.len = input.length;
  }

  peek() {
    return this.input[this.pos];
  }

  error(msg) {
    throw new SafeParseError(`${msg} at position ${this.pos}`);
  }

  skipWhitespaceAndComments() {
    for (;;) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.pos += 1;
        continue;
      }
      // Allow // and /* */ comments defensively (never executed, just skipped)
      if (ch === '/' && this.input[this.pos + 1] === '/') {
        this.pos += 2;
        while (this.pos < this.len && this.input[this.pos] !== '\n') this.pos += 1;
        continue;
      }
      if (ch === '/' && this.input[this.pos + 1] === '*') {
        this.pos += 2;
        while (this.pos < this.len && !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')) this.pos += 1;
        this.pos += 2;
        continue;
      }
      break;
    }
  }

  expect(char) {
    this.skipWhitespaceAndComments();
    if (this.input[this.pos] !== char) {
      this.error(`Expected '${char}'`);
    }
    this.pos += 1;
  }

  parse() {
    this.skipWhitespaceAndComments();
    const value = this.parseValue();
    this.skipWhitespaceAndComments();
    if (this.pos !== this.len) {
      this.error('Unexpected trailing characters');
    }
    return value;
  }

  parseValue() {
    this.skipWhitespaceAndComments();
    const ch = this.peek();

    if (ch === undefined) this.error('Unexpected end of input');
    if (ch === '{') return this.parseObject();
    if (ch === '[') return this.parseArray();
    if (ch === '"' || ch === "'") return this.parseString();
    if (ch === '-' || isDigit(ch)) return this.parseNumber();

    if (this.input.startsWith('true', this.pos)) {
      this.pos += 4;
      return true;
    }
    if (this.input.startsWith('false', this.pos)) {
      this.pos += 5;
      return false;
    }
    if (this.input.startsWith('null', this.pos)) {
      this.pos += 4;
      return null;
    }
    if (this.input.startsWith('undefined', this.pos)) {
      this.pos += 9;
      return undefined;
    }

    this.error(`Unexpected token '${ch}'`);
    return undefined;
  }

  parseObject() {
    const obj = {};
    this.expect('{');
    this.skipWhitespaceAndComments();
    if (this.peek() === '}') {
      this.pos += 1;
      return obj;
    }

    for (;;) {
      this.skipWhitespaceAndComments();
      const key = this.parseKey();
      this.expect(':');
      const value = this.parseValue();
      obj[key] = value;
      this.skipWhitespaceAndComments();
      const next = this.peek();
      if (next === ',') {
        this.pos += 1;
        this.skipWhitespaceAndComments();
        // allow trailing comma before }
        if (this.peek() === '}') {
          this.pos += 1;
          return obj;
        }
        continue;
      }
      if (next === '}') {
        this.pos += 1;
        return obj;
      }
      this.error("Expected ',' or '}'");
    }
  }

  parseKey() {
    this.skipWhitespaceAndComments();
    const ch = this.peek();
    if (ch === '"' || ch === "'") return this.parseString();

    if (!isIdentifierStart(ch)) {
      this.error('Invalid object key');
    }
    const start = this.pos;
    this.pos += 1;
    while (this.pos < this.len && isIdentifierPart(this.input[this.pos])) this.pos += 1;
    return this.input.slice(start, this.pos);
  }

  parseArray() {
    const arr = [];
    this.expect('[');
    this.skipWhitespaceAndComments();
    if (this.peek() === ']') {
      this.pos += 1;
      return arr;
    }

    for (;;) {
      arr.push(this.parseValue());
      this.skipWhitespaceAndComments();
      const next = this.peek();
      if (next === ',') {
        this.pos += 1;
        this.skipWhitespaceAndComments();
        if (this.peek() === ']') {
          this.pos += 1;
          return arr;
        }
        continue;
      }
      if (next === ']') {
        this.pos += 1;
        return arr;
      }
      this.error("Expected ',' or ']'");
    }
  }

  parseString() {
    const quote = this.peek();
    this.pos += 1;
    let result = '';
    while (this.pos < this.len) {
      const ch = this.input[this.pos];
      if (ch === quote) {
        this.pos += 1;
        return result;
      }
      if (ch === '\\') {
        const next = this.input[this.pos + 1];
        const escapes = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', "'": "'", '\\': '\\', '/': '/' };
        if (next === 'u') {
          const hex = this.input.slice(this.pos + 2, this.pos + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.error('Invalid unicode escape');
          result += String.fromCharCode(parseInt(hex, 16));
          this.pos += 6;
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(escapes, next)) {
          result += escapes[next];
          this.pos += 2;
          continue;
        }
        // Unknown escape - keep the char literally (no code execution risk)
        result += next;
        this.pos += 2;
        continue;
      }
      result += ch;
      this.pos += 1;
    }
    this.error('Unterminated string');
    return undefined;
  }

  parseNumber() {
    const start = this.pos;
    if (this.peek() === '-' || this.peek() === '+') this.pos += 1;
    while (isDigit(this.peek())) this.pos += 1;
    if (this.peek() === '.') {
      this.pos += 1;
      while (isDigit(this.peek())) this.pos += 1;
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.pos += 1;
      if (this.peek() === '+' || this.peek() === '-') this.pos += 1;
      while (isDigit(this.peek())) this.pos += 1;
    }
    const raw = this.input.slice(start, this.pos);
    if (!raw || raw === '-' || raw === '+') this.error('Invalid number');
    return Number(raw);
  }
}

// Parses a JSON5-ish string (objects/arrays/strings/numbers/booleans/null
// only - no identifiers as values, no function calls, no operators, no
// `new`, no template literals). Throws SafeParseError on anything else.
// This NEVER executes JavaScript - it only ever builds plain objects,
// arrays, strings, numbers, booleans, or null.
const parseSafeJsonLike = (input) => {
  if (typeof input !== 'string') {
    throw new SafeParseError('Input must be a string');
  }
  return new SafeJsonLikeParser(input).parse();
};

module.exports = { parseSafeJsonLike, SafeParseError };