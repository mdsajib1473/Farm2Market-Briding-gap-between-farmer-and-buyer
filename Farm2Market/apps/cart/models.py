from django.db import models


class Cart(models.Model):
    cart_id = models.AutoField(primary_key=True)
    # Cross-app FK — use string reference to avoid circular imports
    buyer = models.OneToOneField(
        'accounts.Profile',
        on_delete=models.CASCADE,
        related_name="cart"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart - {self.buyer.user.username}"


class CartItem(models.Model):
    cart_item_id = models.AutoField(primary_key=True)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    # Cross-app FK — use string reference to avoid circular imports
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    def subtotal(self):
        return self.product.price_per_unit * self.quantity

    def __str__(self):
        return f"{self.quantity} x {self.product.name} (Cart: {self.cart.buyer.user.username})"
