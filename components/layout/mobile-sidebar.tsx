"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./sidebar";

export function MobileSidebar({
  role,
  userName,
  userEmail,
}: {
  role: string;
  userName: string;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Buka menu">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="fixed inset-y-0 left-0 h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 p-0 data-[state=open]:animate-in">
        <DialogTitle className="sr-only">Menu navigasi</DialogTitle>
        <SidebarContent
          role={role}
          userName={userName}
          userEmail={userEmail}
          onNavigate={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
