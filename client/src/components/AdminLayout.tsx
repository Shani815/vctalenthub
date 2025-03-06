import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <div className="w-64 border-r">
        <AdminSidebar />
      </div>
      <div className="flex-1 overflow-auto p-8">
        {children}
      </div>
    </div>
  );
}
