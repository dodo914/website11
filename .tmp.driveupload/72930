// ============================================================
// ===== LAVA License Errors (PART 1B) =========================
// ============================================================
// الموديول ده معمول خصيصًا لـLicense domain لأن الـerror pattern
// الموجود بالفعل (services/shipping/providerErrors.js + structuredError
// في orderAddress.js) مبني حوالين رسائل شحن بالعربي مرتبطة بمزودين
// خارجيين (Bosta/Aramex/DHL) ومش abstraction عامة معاد استخدامها في أماكن
// تانية بالمشروع - فمالوش داعي "نلوي" الـLicense errors عليه.
// بدل كده، عملنا class hierarchy بسيطة (زي أي Node app عادي) بنفس الفكرة:
// كل error معاه `code` ثابت وembedded `publicMessage` آمن يتقال للعميل،
// لحد ما الـcontrollers بتاعة الـLicense API تتعمل لاحقًا وتستخدمها بدل ما
// تسرّب err.message/err.stack الخام.
class LicenseError extends Error {
  constructor(code, publicMessage, details = {}) {
    super(publicMessage);
    this.name = this.constructor.name;
    this.code = code;
    this.publicMessage = publicMessage;
    // أي تفاصيل إضافية (زي licenseId) بتتحط هنا - ممنوع تحتوي secrets.
    this.details = details;
  }

  /** شكل آمن للإرجاع في أي API response مستقبلي - من غير stack/internal details. */
  toSafeJSON() {
    return { code: this.code, message: this.publicMessage };
  }
}

class InvalidLicenseError extends LicenseError {
  constructor(details = {}) {
    super('INVALID_LICENSE', 'License is invalid.', details);
  }
}

class LicenseExpiredError extends LicenseError {
  constructor(details = {}) {
    super('LICENSE_EXPIRED', 'License has expired.', details);
  }
}

class LicenseRevokedError extends LicenseError {
  constructor(details = {}) {
    super('LICENSE_REVOKED', 'License has been revoked.', details);
  }
}

class LicenseSuspendedError extends LicenseError {
  constructor(details = {}) {
    super('LICENSE_SUSPENDED', 'License is suspended.', details);
  }
}

class ActivationLimitError extends LicenseError {
  constructor(details = {}) {
    super('ACTIVATION_LIMIT_REACHED', 'License activation limit reached.', details);
  }
}

class LicenseDomainNotAllowedError extends LicenseError {
  constructor(details = {}) {
    super('LICENSE_DOMAIN_NOT_ALLOWED', 'This domain is not allowed for this license.', details);
  }
}

// ---- PART 2A: remote foundation errors ----
// مهم: الـerror ده لوحده **مش** معناه إن الترخيص revoked أو invalid -
// معناه بس إننا مش قادرين نتواصل مع/نثق في الـLicense Server دلوقتي
// (disabled/not configured/timeout/transport error). القرار الفعلي
// (استخدام آخر remote state موثوقة جوه الـgrace period، أو رفض العملية)
// بيرجع للـcaller (Prompt 2B/2C) - مش للـerror ده نفسه.
class RemoteLicenseUnavailableError extends LicenseError {
  constructor(details = {}) {
    super('REMOTE_LICENSE_UNAVAILABLE', 'Unable to reach the license server right now.', details);
  }
}

// ---- PART 2B-1: remote protocol/response validation errors ----
// مهم: الأربعة دول بيمثلوا فشل في الـprotocol/envelope/signature نفسها
// (شكل الرد غير موثوق أو غير متوقع) - **مش** قرار بتاع الترخيص نفسه (زي
// revoked/expired). نفس مبدأ RemoteLicenseUnavailableError فوق: القرار
// الفعلي إزاي نتعامل مع الفشل ده (نستخدم آخر state جوه grace period، أو
// نرفض) بيرجع للـcaller (Prompt 2B-2/2C) - مش لهم هما.
class RemoteProtocolInvalidError extends LicenseError {
  constructor(details = {}) {
    super('REMOTE_PROTOCOL_INVALID', 'The license server response uses an unsupported protocol version.', details);
  }
}

class RemoteSignatureInvalidError extends LicenseError {
  constructor(details = {}) {
    super('REMOTE_SIGNATURE_INVALID', 'The license server response could not be verified.', details);
  }
}

class RemoteResponseInvalidError extends LicenseError {
  constructor(details = {}) {
    super('REMOTE_RESPONSE_INVALID', 'The license server response is malformed.', details);
  }
}

class RemoteResponseExpiredError extends LicenseError {
  constructor(details = {}) {
    super('REMOTE_RESPONSE_EXPIRED', 'The license server response is stale.', details);
  }
}

class RemoteRequestIdMismatchError extends LicenseError {
  constructor(details = {}) {
    super('REMOTE_REQUEST_ID_MISMATCH', 'The license server response does not match the original request.', details);
  }
}

module.exports = {
  LicenseError,
  InvalidLicenseError,
  LicenseExpiredError,
  LicenseRevokedError,
  LicenseSuspendedError,
  ActivationLimitError,
  LicenseDomainNotAllowedError,
  RemoteLicenseUnavailableError,
  RemoteProtocolInvalidError,
  RemoteSignatureInvalidError,
  RemoteResponseInvalidError,
  RemoteResponseExpiredError,
  RemoteRequestIdMismatchError,
};