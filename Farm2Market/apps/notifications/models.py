from django.db import models


class Notification(models.Model):
    notification_id = models.AutoField(primary_key=True)
    # Cross-app FKs — string references to avoid circular imports
    recipient       = models.ForeignKey(
        'accounts.Profile',
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    order           = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    message         = models.TextField()
    is_read         = models.BooleanField(default=False)
    created_at      = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification → {self.recipient.user.username}: {self.message[:40]}"
