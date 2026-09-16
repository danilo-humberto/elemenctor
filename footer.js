(function () {
  function getCurrentYear(date = new Date()) {
    return date.getFullYear();
  }

  function updateFooterYear(root = document, date = new Date()) {
    const year = String(getCurrentYear(date));

    root.querySelectorAll('[data-current-year]').forEach((element) => {
      element.textContent = year;
      element.setAttribute('datetime', year);
    });

    return year;
  }

  if (typeof document !== 'undefined') {
    updateFooterYear();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getCurrentYear, updateFooterYear };
  }
})();
