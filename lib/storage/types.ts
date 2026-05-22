// อินเทอร์เฟซเดียวสำหรับ media storage (DESIGN.md ข้อ 6.2)
// โค้ดที่เรียกใช้ไม่ต้องรู้ว่าเบื้องหลังเป็น filesystem (local) หรือ Vercel Blob (prod)

export type PutInput = {
  /** ข้อมูลไฟล์ */
  data: Buffer | Uint8Array | ArrayBuffer;
  /** ชื่อไฟล์เดิม (เอาไว้ดึงนามสกุล) */
  filename: string;
  /** MIME type */
  contentType: string;
};

export type PutResult = {
  /** URL ที่เอาไปแสดง/ดาวน์โหลดได้ */
  url: string;
  /** key ภายในไว้ใช้ลบ */
  pathname: string;
};

export interface MediaStorage {
  put(input: PutInput): Promise<PutResult>;
  delete(pathname: string): Promise<void>;
}
