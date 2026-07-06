from django.db import models


class Logistic(models.Model):
    name = models.CharField(max_length=100)  # e.g., Pathao, Uber, Steadfast
    contact_number = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.name


class Order(models.Model):
    STATUS_CHOICES = [
        ('PENDING',          'Order Placed'),
        ('CONFIRMED',        'Order Confirmed'),
        ('ASSIGNED',         'Delivery Assigned'),
        ('OUT_FOR_DELIVERY', 'Out for Delivery'),
        ('DELIVERED',        'Delivered'),
        ('COMPLETED',        'Completed'),
        ('REJECTED',         'Rejected'),
        ('CANCELLED',        'Cancelled'),
    ]

    order_id      = models.AutoField(primary_key=True)
    # Cross-app FKs — string references to avoid circular imports
    buyer         = models.ForeignKey(
        'accounts.Profile',
        on_delete=models.CASCADE,
        related_name='orders'
    )
    farmer        = models.ForeignKey(
        'accounts.Profile',
        on_delete=models.CASCADE,
        related_name='received_orders'
    )
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    logistic      = models.ForeignKey(Logistic, on_delete=models.SET_NULL, null=True, blank=True)
    delivery_note = models.TextField(blank=True, null=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order #{self.order_id} | {self.buyer} → {self.farmer} | {self.status}"


class OrderItem(models.Model):
    order_item_id  = models.AutoField(primary_key=True)
    order          = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    # Cross-app FK — string reference
    product        = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    quantity       = models.PositiveIntegerField(default=1)
    price_at_order = models.IntegerField()  # snapshot of price when ordered

    def subtotal(self):
        return self.price_at_order * self.quantity

    def __str__(self):
        return f"OrderItem #{self.order_item_id} — {self.product.name} x{self.quantity}"
