import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DeleteAuthModalProps {
  open: boolean;
  loading?: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: (password: string) => Promise<void>;
}

export default function DeleteAuthModal({ open, loading = false, onOpenChange, onConfirm }: DeleteAuthModalProps) {
  const [password, setPassword] = useState('');

  const handleConfirm = async () => {
    await onConfirm(password);
    setPassword('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Confirm Client Deletion</DialogTitle>
          <DialogDescription>
            Re-enter password to confirm deletion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your account password"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button className="erp-btn-danger" onClick={handleConfirm} disabled={loading || !password.trim()}>
            {loading ? 'Verifying...' : 'Delete Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
