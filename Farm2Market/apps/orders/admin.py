from django.contrib import admin
from .models import Logistic, Order, OrderItem

admin.site.register(Logistic)
admin.site.register(Order)
admin.site.register(OrderItem)
