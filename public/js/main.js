document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-confirm]').forEach(form => {
    form.addEventListener('submit', e => {
      if (!confirm(form.dataset.confirm || 'Are you sure?')) e.preventDefault();
    });
  });
  document.querySelectorAll('[data-fee-course]').forEach(select => {
    select.addEventListener('change', () => {
      const option = select.options[select.selectedIndex];
      const fee = document.querySelector('[name="fee"]');
      if (fee && option.dataset.price) fee.value = option.dataset.price;
    });
  });
});
