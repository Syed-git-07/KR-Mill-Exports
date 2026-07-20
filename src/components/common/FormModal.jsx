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
  showDelete = false,
  deleteLabel = "Delete",
  deleteIsDanger = false,
  onSecondaryAction,
  secondaryActionLabel = "Action",
  secondaryActionClassName = "border-orange-500 text-orange-600 hover:bg-orange-50",
  formId,
}) {
  const handleSave = () => {
    if (formId) {
      const form = document.getElementById(formId)
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit()
          return
        }

        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]')
        if (submitButton) {
          submitButton.click()
          return
        }

        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        return
      }
    }

    if (onSave) {
      onSave()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="py-4 overflow-y-auto">
          {children}
        </div>
        
        <DialogFooter className="flex justify-between sticky bottom-0 bg-white pt-4 border-t">
          <div className="flex gap-2">
          {onSecondaryAction && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              disabled={isLoading}
              className={secondaryActionClassName}
            >
              {secondaryActionLabel}
            </Button>
          )}
          {showDelete && onDelete && (
            <Button 
              variant={deleteIsDanger ? "default" : "outline"}
              onClick={onDelete}
              disabled={isLoading}
              className={deleteIsDanger
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "border-red-600 text-red-600 hover:bg-red-50"}
            >
              {deleteLabel}
            </Button>
          )}
          </div>
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
              type={formId ? 'submit' : 'button'}
              form={formId || undefined}
              onClick={handleSave}
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
