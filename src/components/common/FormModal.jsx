'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function FormModal({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  children,
  onSave,
  onCancel,
  onDelete,
  saveLabel = "Update",
  isLoading = false,
  showDelete = false
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-gray-200 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="py-4">
          {children}
        </div>
        
        <DialogFooter className="flex justify-between">
          {showDelete && onDelete && (
            <Button 
              variant="outline"
              onClick={onDelete}
              disabled={isLoading}
              className="border-red-600 text-red-600 hover:bg-red-50"
            >
              Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={isLoading}
              className="border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={onSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : saveLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
