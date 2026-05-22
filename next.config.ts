import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // ตรึง workspace root ที่โฟลเดอร์นี้ (มี lockfile อื่นบนเครื่องทำให้ Next เดา root ผิด)
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
