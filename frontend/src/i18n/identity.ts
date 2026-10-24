export const identityCopy = {
  en: { login: 'Log in', register: 'Create account', logout: 'Log out', account: 'Your account', home: 'Home', email: 'Email', password: 'Password', required: 'required',
    hint: 'Use an email address you control. Passwords can be passphrases of 12–128 characters.', pending: 'Please wait…', restoring: 'Checking your session…',
    unavailable: 'We cannot check your account right now. Please retry.', retry: 'Retry', guest: 'Log in to access your account.',
    credentials: 'The email or password is incorrect, or access is unavailable.', validation: 'Please check the highlighted fields.',
    emailError: 'Enter a valid email address.', passwordError: 'Use 12–128 characters. Your password is kept exactly as entered.',
    conflict: 'This registration could not be completed. Try logging in or review your details.', limited: 'Too many attempts. Please wait before trying again.',
    forbidden: 'This action is unavailable. Refresh your session and try again.', language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark', system: 'System',
    signInAgain: 'Your session has ended. Please log in again.' },
  vi: { login: 'Đăng nhập', register: 'Tạo tài khoản', logout: 'Đăng xuất', account: 'Tài khoản của bạn', home: 'Trang chủ', email: 'Email', password: 'Mật khẩu', required: 'bắt buộc',
    hint: 'Dùng địa chỉ email bạn kiểm soát. Mật khẩu có thể là cụm từ gồm 12–128 ký tự.', pending: 'Vui lòng chờ…', restoring: 'Đang kiểm tra phiên đăng nhập…',
    unavailable: 'Hiện chưa thể kiểm tra tài khoản. Vui lòng thử lại.', retry: 'Thử lại', guest: 'Đăng nhập để truy cập tài khoản.',
    credentials: 'Email hoặc mật khẩu không đúng, hoặc quyền truy cập không khả dụng.', validation: 'Vui lòng kiểm tra các trường được đánh dấu.',
    emailError: 'Nhập địa chỉ email hợp lệ.', passwordError: 'Dùng 12–128 ký tự. Mật khẩu được giữ nguyên như bạn nhập.',
    conflict: 'Chưa thể hoàn tất đăng ký. Hãy thử đăng nhập hoặc kiểm tra thông tin.', limited: 'Có quá nhiều lần thử. Vui lòng chờ trước khi thử lại.',
    forbidden: 'Thao tác không khả dụng. Hãy kiểm tra lại phiên đăng nhập.', language: 'Ngôn ngữ', theme: 'Giao diện', light: 'Sáng', dark: 'Tối', system: 'Hệ thống',
    signInAgain: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.' },
} as const;
export type Locale = keyof typeof identityCopy;
