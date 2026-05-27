const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        const target = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove("active"));
        tabs.forEach(t => t.classList.add("inactive"));
        tab.classList.add("active");
        tab.classList.remove("inactive");

        tabContents.forEach(tc => tc.classList.add("hidden"));
        document.getElementById(`${target}-tab`).classList.remove("hidden");
    });
});
