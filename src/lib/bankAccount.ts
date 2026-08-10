// 신청 완료 화면과 신청확인 문자에서 공유해서 쓰는 무통장입금 계좌 정보.
// 예금주는 개인 명의라 보안상 가운데 글자를 마스킹해서 노출한다.
export const BANK_ACCOUNT = {
  bankName: "카카오뱅크",
  accountNumber: "3333052843942",
  accountHolder: "김*온",
} as const;
