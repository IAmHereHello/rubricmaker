import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { useResultsStore } from '@/hooks/useResultsStore';

interface PrivacyKeyDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PrivacyKeyDialog({ isOpen, onOpenChange }: PrivacyKeyDialogProps) {
    const [keyInput, setKeyInput] = useState('');
    const [error, setError] = useState('');
    const { setPrivacyKey } = useResultsStore();

    const handleSave = () => {
        if (keyInput.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }
        setPrivacyKey(keyInput);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(val) => {
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        Set Privacy Password
                    </DialogTitle>
                    <DialogDescription>
                        To ensure student data privacy, all names and grades are <strong>encrypted</strong> on your device before being sent to the cloud. Only you can read them with this password.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="privacy-key">Encryption Password</Label>
                        <Input
                            id="privacy-key"
                            type="password"
                            placeholder="Enter a secure password..."
                            value={keyInput}
                            onChange={(e) => {
                                setKeyInput(e.target.value);
                                setError('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                            }}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        <strong>Note:</strong> If you lose this password, you will not be able to recover the student data. We do not store this password.
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={!keyInput}>
                        Save & Unlock
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
