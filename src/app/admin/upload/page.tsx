import { Uploader } from "@/components/admin/uploader";

export const metadata = { title: "Upload" };

export default function UploadPage() {
  return (
    <>
      <h1>Upload</h1>
      <Uploader />
    </>
  );
}
