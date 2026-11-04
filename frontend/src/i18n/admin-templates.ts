// I04-P04 — VI/EN operational copy for the Admin Templates experience.
// Same dual-locale shape as i18n/admin.ts and i18n/templates.ts. Locale comes
// from the shared preferences provider; nothing here is a permission check —
// the backend remains authoritative (BR-VAL-001, "fake permissions" out of scope).

export type TemplateAdminLocale = 'en' | 'vi';

export const templateAdminCopy = {
  en: {
    // Shell / nav
    brand: 'LumiCal', adminArea: 'Admin', role: 'Operations admin',
    navTemplates: 'Templates', navOrders: 'Orders', navUsers: 'Users',
    navNotifications: 'Notifications', navSettings: 'Settings',
    navGroup: 'Admin',
    skip: 'Skip to content',

    eyebrow: 'Operations', refresh: 'Refresh',

    // Availability vocabulary
    availInactive: 'Inactive', availActive: 'Active', availArchived: 'Archived',
    // Category vocabulary
    catGeneral: 'General', catBirthday: 'Birthday', catAnniversary: 'Anniversary', catHoliday: 'Holiday',

    // List screen
    listTitle: 'Templates', listDesc: 'Review availability and publish complete, approved revisions.',
    listCaption: 'Operational template catalog. Availability drives what new projects can start.',
    create: 'New template',
    filterLabel: 'Availability', allStates: 'All availabilities',
    thTemplate: 'Template', thCategory: 'Category', thAvailability: 'Availability',
    thVersion: 'Version', thPublished: 'Published', thAction: 'Action',
    tableCaption: 'Operational template list. Availability is shown as a word, never colour alone.',
    manage: 'Manage',
    publishedRev: 'Revision {n}', neverPublished: 'Not published',
    versionLabel: 'v{n}',
    loadMore: 'Load next page', endOfList: 'End of list',
    prev: 'Previous page',
    resultCount: '{n} shown',

    // New / create screen
    newTitle: 'Create template', newDesc: 'A new template starts inactive. Publish a revision, then activate it when it is complete.',
    crumbTemplates: 'Templates', crumbNew: 'New template',
    sectionContent: 'Content', sectionPresets: 'Presets', sectionPrice: 'Price',
    categoryLabel: 'Category', categoryHelp: 'The category a template is filed under. It cannot change later.',
    layoutLabel: 'Layout', layoutHelp: 'Locked to the approved version 1 layout: 12 months, up to 4 images per month.',
    layoutPhotoFocus: 'Photo focus', layoutCollage: 'Collage',
    nameLabel: 'Name', descLabel: 'Description',
    langVi: 'Vietnamese', langEn: 'English',
    presetsHelp: 'Choose at least one approved preset. Each can be selected once.',
    presetClassic: 'Classic', presetMinimal: 'Minimal', presetVibrant: 'Vibrant',
    priceLabel: 'Base unit price (USD)', priceHelp: 'Charged per calendar. Shown to you as it will be stored.',
    pricePreview: 'Will be stored as {minor} minor units',
    reasonLabel: 'Reason', reasonOptional: 'optional', reasonRequired: 'required',
    cancel: 'Cancel',
    reasonPh: 'Why this change?',
    reasonHelp: 'Recorded in the audit trail for this action.',

    // Detail screen
    detailTitle: 'Template', detailDesc: 'Availability, version and the immutable publication history.',
    crumbDetail: 'Manage',
    stateRow: 'Availability', versionRow: 'Version', publishedRow: 'Published revision',
    publishSection: 'Publish a new revision', publishDesc: 'A revision is immutable once published. Existing projects keep the baseline they captured.',
    availabilitySection: 'Availability',

    // Availability dialog
    availTitle: 'Change availability', availDesc: 'This updates what new projects can start from {id}. The reason is stored as the audit purpose.',
    resultActive: 'New projects will be able to start from this template.',
    resultInactive: 'New projects will not be able to start from this template; existing projects are unaffected.',
    resultArchived: 'This template leaves the active catalog. Existing projects are unaffected and it can be restored.',
    activate: 'Activate', deactivate: 'Deactivate', archive: 'Archive',
    availConfirm: 'Save availability',
    availReasonPh: 'Why this availability change?',

    // Review dialog
    reviewTitle: 'Review revision', reviewDesc: 'Check exactly what will be saved. Publishing cannot be undone.',
    reviewCreateTitle: 'Review new template', reviewPublishTitle: 'Review revision to publish',
    summaryCategory: 'Category', summaryLayout: 'Layout', summaryName: 'Name',
    summaryDesc: 'Description', summaryPresets: 'Presets', summaryPrice: 'Price', summaryReason: 'Reason',
    confirmCreate: 'Create template', confirmPublish: 'Publish revision',

    // Conflict (412)
    conflictTitle: 'This template changed elsewhere',
    conflictDesc: 'Someone updated it while you were editing. Current version is {version}. Refresh to load it, then re-apply your change. Your entries are kept.',
    refreshVersion: 'Refresh current version',
    currentVersionIs: 'Current version: v{version}',

    // Outcome / status
    saving: 'Saving…', savingList: 'Loading templates…',
    createdOk: 'Template created as inactive.', publishedOk: 'Revision {n} published.',
    availOk: 'Availability set to {state}.',
    unavailable: 'The template service is unavailable right now.', retry: 'Try again',
    intentReviewTitle: 'Check the earlier submission',
    intentReviewDesc: 'The earlier submission may have completed. Check the current catalog state before starting a new operation. If the original draft is still open, you can submit it again to retry.',
    intentReviewAck: 'I reviewed the catalog. Allow a new submission',
    forbidden: 'You do not have permission to manage templates.', notFound: 'That template no longer exists.',
    unauthenticated: 'Your session ended. Sign in again to continue.',
    incompletePublication: 'This template has no complete published revision yet, so it cannot go live. Publish a valid revision first.',

    // Client-side validation (mirrors backend limits for early help; backend stays authoritative)
    errRequired: 'This field is required.',
    errTextMax: 'Use 1 to 500 characters.',
    errPresetNameMax: 'Use up to 120 characters.',
    errPresets: 'Choose at least one preset.',
    errPrice: 'Enter a positive USD amount, for example 24.00.',
    errReason: 'Enter a reason of 1 to 1000 characters.',
    errSummary: 'Fix the highlighted fields before continuing.',
  },
  vi: {
    brand: 'LumiCal', adminArea: 'Quản trị', role: 'Nhân viên vận hành',
    navTemplates: 'Mẫu', navOrders: 'Đơn hàng', navUsers: 'Người dùng',
    navNotifications: 'Thông báo', navSettings: 'Cài đặt',
    navGroup: 'Quản trị',
    skip: 'Bỏ qua đến nội dung',

    eyebrow: 'Vận hành', refresh: 'Làm mới',

    availInactive: 'Tạm ngừng', availActive: 'Đang hiển thị', availArchived: 'Đã lưu trữ',
    catGeneral: 'Chung', catBirthday: 'Sinh nhật', catAnniversary: 'Kỷ niệm', catHoliday: 'Ngày lễ',

    listTitle: 'Mẫu', listDesc: 'Theo dõi trạng thái hiển thị và phát hành các phiên bản hoàn chỉnh, đã duyệt.',
    listCaption: 'Danh mục mẫu vận hành. Trạng thái hiển thị quyết định dự án mới bắt đầu được từ đâu.',
    create: 'Tạo mẫu mới',
    filterLabel: 'Trạng thái hiển thị', allStates: 'Tất cả trạng thái',
    thTemplate: 'Mẫu', thCategory: 'Danh mục', thAvailability: 'Trạng thái',
    thVersion: 'Phiên bản', thPublished: 'Đã phát hành', thAction: 'Thao tác',
    tableCaption: 'Danh sách mẫu vận hành. Trạng thái hiển thị bằng chữ, không chỉ bằng màu.',
    manage: 'Quản lý',
    publishedRev: 'Phiên bản {n}', neverPublished: 'Chưa phát hành',
    versionLabel: 'v{n}',
    loadMore: 'Tải trang tiếp', endOfList: 'Đã hết danh sách',
    prev: 'Trang trước',
    resultCount: 'Đang hiển thị {n}',

    newTitle: 'Tạo mẫu', newDesc: 'Mẫu mới bắt đầu ở trạng thái tạm ngừng. Phát hành một phiên bản, rồi kích hoạt khi đã hoàn chỉnh.',
    crumbTemplates: 'Mẫu', crumbNew: 'Tạo mẫu',
    sectionContent: 'Nội dung', sectionPresets: 'Kiểu mẫu', sectionPrice: 'Giá',
    categoryLabel: 'Danh mục', categoryHelp: 'Mẫu được phân vào danh mục này và không đổi sau khi tạo.',
    layoutLabel: 'Bố cục', layoutHelp: 'Đóng băng theo bố cục phiên bản 1 đã duyệt: 12 tháng, tối đa 4 ảnh mỗi tháng.',
    layoutPhotoFocus: 'Tập trung ảnh', layoutCollage: 'Lắp ghép',
    nameLabel: 'Tên', descLabel: 'Mô tả',
    langVi: 'Tiếng Việt', langEn: 'Tiếng Anh',
    presetsHelp: 'Chọn ít nhất một kiểu mẫu đã duyệt. Mỗi kiểu chỉ chọn một lần.',
    presetClassic: 'Cổ điển', presetMinimal: 'Tối giản', presetVibrant: 'Sống động',
    priceLabel: 'Đơn giá gốc (USD)', priceHelp: 'Tính theo mỗi lịch. Hiển thị đúng giá trị sẽ được lưu.',
    pricePreview: 'Sẽ lưu thành {minor} đơn vị nhỏ',
    reasonLabel: 'Lý do', reasonOptional: 'tuỳ chọn', reasonRequired: 'bắt buộc',
    cancel: 'Huỷ',
    reasonPh: 'Vì sao thực hiện thay đổi này?',
    reasonHelp: 'Được ghi vào lịch sử kiểm toán của thao tác này.',

    detailTitle: 'Mẫu', detailDesc: 'Trạng thái hiển thị, phiên bản và lịch sử phát hành bất biến.',
    crumbDetail: 'Quản lý',
    stateRow: 'Trạng thái hiển thị', versionRow: 'Phiên bản', publishedRow: 'Phiên bản đã phát hành',
    publishSection: 'Phát hành phiên bản mới', publishDesc: 'Phiên bản không đổi sau khi phát hành. Các dự án hiện có vẫn giữ baseline đã chụp.',
    availabilitySection: 'Trạng thái hiển thị',

    availTitle: 'Đổi trạng thái hiển thị', availDesc: 'Thao tác này đổi dự án mới bắt đầu được từ đâu. Lý do được lưu làm chủ đích kiểm thử.',
    resultActive: 'Dự án mới sẽ bắt đầu được từ mẫu này.',
    resultInactive: 'Dự án mới sẽ không bắt đầu được từ mẫu này; các dự án hiện có không bị ảnh hưởng.',
    resultArchived: 'Mẫu rời khỏi danh mục đang hiển thị. Dự án hiện có không bị ảnh hưởng và có thể khôi phục.',
    activate: 'Kích hoạt', deactivate: 'Vô hiệu hoá', archive: 'Lưu trữ',
    availConfirm: 'Lưu trạng thái',
    availReasonPh: 'Vì sao đổi trạng thái hiển thị này?',

    reviewTitle: 'Xem lại phiên bản', reviewDesc: 'Kiểm tra chính xác những gì sẽ được lưu. Phát hành không thể hoàn tác.',
    reviewCreateTitle: 'Xem lại mẫu mới', reviewPublishTitle: 'Xem lại phiên bản sắp phát hành',
    summaryCategory: 'Danh mục', summaryLayout: 'Bố cục', summaryName: 'Tên',
    summaryDesc: 'Mô tả', summaryPresets: 'Kiểu mẫu', summaryPrice: 'Giá', summaryReason: 'Lý do',
    confirmCreate: 'Tạo mẫu', confirmPublish: 'Phát hành phiên bản',

    conflictTitle: 'Mẫu này đã thay đổi ở phiên khác',
    conflictDesc: 'Có người cập nhật trong lúc bạn đang chỉnh. Phiên bản hiện tại là {version}. Hãy làm mới để tải bản mới rồi thực hiện lại. Phần bạn nhập vẫn được giữ.',
    refreshVersion: 'Làm mới phiên bản hiện tại',
    currentVersionIs: 'Phiên bản hiện tại: v{version}',

    saving: 'Đang lưu…', savingList: 'Đang tải mẫu…',
    createdOk: 'Đã tạo mẫu ở trạng thái tạm ngừng.', publishedOk: 'Đã phát hành phiên bản {n}.',
    availOk: 'Đã đặt trạng thái hiển thị thành {state}.',
    unavailable: 'Dịch vụ mẫu tạm thời không khả dụng.', retry: 'Thử lại',
    intentReviewTitle: 'Kiểm tra lần gửi trước',
    intentReviewDesc: 'Lần gửi trước có thể đã thành công. Hãy kiểm tra trạng thái danh mục hiện tại trước khi thực hiện thao tác mới. Nếu bản nháp ban đầu vẫn đang mở, bạn có thể gửi lại bản nháp đó để thử lại.',
    intentReviewAck: 'Tôi đã kiểm tra danh mục. Cho phép gửi thao tác mới',
    forbidden: 'Bạn không có quyền quản lý mẫu.', notFound: 'Mẫu này không còn tồn tại.',
    unauthenticated: 'Phiên của bạn đã hết. Đăng nhập lại để tiếp tục.',
    incompletePublication: 'Mẫu này chưa có phiên bản phát hành hoàn chỉnh nên chưa thể hiển thị. Hãy phát hành một phiên bản hợp lệ trước.',

    errRequired: 'Trường này là bắt buộc.',
    errTextMax: 'Dùng từ 1 đến 500 ký tự.',
    errPresetNameMax: 'Dùng tối đa 120 ký tự.',
    errPresets: 'Chọn ít nhất một kiểu mẫu.',
    errPrice: 'Nhập một số USD dương, ví dụ 24.00.',
    errReason: 'Nhập lý do từ 1 đến 1000 ký tự.',
    errSummary: 'Sửa các trường đang báo lỗi trước khi tiếp tục.',
  },
} as const;

export type TemplateAdminKey = keyof (typeof templateAdminCopy)['en'];

/** `{placeholder}` interpolation. */
export function formatTemplateAdmin(locale: TemplateAdminLocale, key: TemplateAdminKey, vars: Record<string, string | number> = {}): string {
  const template: string = templateAdminCopy[locale][key];
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

const LANG: Record<TemplateAdminLocale, string> = { en: 'English', vi: 'Tiếng Việt' };

/**
 * Localize a backend field error. The contract reports `messageKey = "validation.<path>"`
 * (see backend/src/platform/http/api-errors.ts), so the field path is the stable key.
 * Unknown paths fall back to a generic, still-safe message.
 */
export function fieldErrorMessage(locale: TemplateAdminLocale, path: string): string {
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  switch (path) {
    case 'name.vi': case 'name.en':
      return `${t('nameLabel')} (${LANG[path === 'name.vi' ? 'vi' : 'en']}): ${t('errTextMax')}`;
    case 'description.vi': case 'description.en':
      return `${t('descLabel')} (${LANG[path === 'description.vi' ? 'vi' : 'en']}): ${t('errTextMax')}`;
    case 'presets': return t('errPresets');
    case 'presets.vi': case 'presets.en':
      return `${t('presetsHelp')} (${LANG[path === 'presets.vi' ? 'vi' : 'en']}): ${t('errPresetNameMax')}`;
    case 'price.unitPriceMinor': case 'price': return t('errPrice');
    case 'price.currency': return `${t('priceLabel')}: USD`;
    case 'reason': return t('errReason');
    case 'availability': return `${t('filterLabel')}: ${t('errRequired')}`;
    case 'category': return `${t('categoryLabel')}: ${t('errRequired')}`;
    case 'layout': return t('layoutHelp');
    default: return t('errRequired');
  }
}

/** Human error for a whole-request failure code (not a single field). */
export function requestErrorMessage(locale: TemplateAdminLocale, code: string): string {
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  switch (code) {
    case 'VERSION_CONFLICT': return t('conflictTitle');
    case 'INCOMPLETE_PUBLICATION': return t('incompletePublication');
    case 'FORBIDDEN': return t('forbidden');
    case 'NOT_FOUND': return t('notFound');
    case 'UNAUTHENTICATED': return t('unauthenticated');
    case 'PROVIDER_UNAVAILABLE': case 'INTERNAL_ERROR': return t('unavailable');
    default: return t('errSummary');
  }
}
