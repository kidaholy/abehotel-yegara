// Simple in-memory notification store
// In production, this should be replaced with Redis or a database

interface Notification {
  id: string
  type: "info" | "success" | "warning" | "error"
  message: string
  timestamp: Date
  targetRole?: string
  targetUser?: string
  read: boolean
}

let notifications: Notification[] = []

export function addNotification(
  type: "info" | "success" | "warning" | "error",
  message: string,
  targetRole?: string,
  targetUser?: string
): Notification {
  const notification: Notification = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type,
    message,
    timestamp: new Date(),
    targetRole,
    targetUser,
    read: false
  }

  notifications.unshift(notification)
  
  // Keep only last 100 notifications
  notifications = notifications.slice(0, 100)
  
  console.log(`📢 Notification added: ${message} (${targetRole || 'all'})`)
  
  return notification
}

export function getNotifications(userRole?: string, userId?: string, permissions: string[] = []): Notification[] {
  return notifications.filter(notif => {
    // Admins see everything
    if (userRole === 'admin' || userRole === 'super-admin') return true;

    // If it's for a specific user, only they see it
    if (notif.targetUser) {
      return notif.targetUser === userId;
    }

    // If it's for a specific role, match role OR permission equivalent
    if (notif.targetRole) {
      if (notif.targetRole === userRole) return true;
      
      // Specifically allow users with cashier:access to see cashier notifications
      if (notif.targetRole === 'cashier' && permissions.includes("cashier:access")) return true;
      
      return false;
    }

    // If no target role/user, it's global
    return true;
  }).slice(0, 10) // Get latest 10 notifications
}

export function markAsRead(notificationId: string): boolean {
  const notification = notifications.find(n => n.id === notificationId)
  if (notification) {
    notification.read = true
    return true
  }
  return false
}

export function clearOldNotifications(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  notifications = notifications.filter(n => n.timestamp > oneHourAgo)
}