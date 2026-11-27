      /* wye-bridge:start — 관리자 화면에서 명단을 받고, 고친 내용을 돌려주는 부분(우주이스케이프 관리자 개편 6단계).
         디자인 · 템플릿 · 폰트는 건드리지 않는다. 이 블록은 scripts/admin-tools/patch-nametag-maker.mjs 가 넣는다.

         관리자 화면(부모 창)과 주고받는 메시지
           ← wye-badge-roster     { people: [{ name, count, box?, manualSize? }], group?, experience?, edition? }
           ← wye-badge-get-state  고친 내용을 달라
           → wye-badge-ready      받을 준비가 됐다
           → wye-badge-loaded     { count } 명단을 채웠다
           → wye-badge-state      { state: { edition, experience, people: [{ name, count, box, manualSize }] } }
         닉네임과 방수만 오간다. 이름 · 연락처는 오지 않는다. 파일을 그냥 열면(부모 창이 없으면) 이 블록은 아무것도 하지 않는다. */
      var wyeEmbedded = window.parent !== window;
      var wyeParentOrigin = "*";

      function wyePick(name, value) {
        var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
        if (!input || input.checked) return;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      function wyeNumber(value, min, max) {
        var n = Number(value);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
      }

      function wyeBox(box) {
        if (!box || typeof box !== "object") return null;
        var x = wyeNumber(box.x, -100, 200), y = wyeNumber(box.y, -100, 200), w = wyeNumber(box.w, 1, 200), h = wyeNumber(box.h, 1, 200);
        return x == null || y == null || w == null || h == null ? null : { x: x, y: y, w: w, h: h };
      }

      function wyeLoadRoster(data) {
        var list = (Array.isArray(data.people) ? data.people : []).slice(0, 300);
        el.peopleList.replaceChildren();
        state.people = [];
        state.selectedId = null;
        if (Object.prototype.hasOwnProperty.call(EXPERIENCE_RULES, data.experience)) wyePick("experience", data.experience);
        if (data.edition === "regular" || data.edition === "christmas") wyePick("edition", data.edition);
        var layouts = [];
        list.forEach(function (p) {
          var name = String(p && p.name != null ? p.name : "").normalize("NFC").trim().slice(0, 40);
          var count = Math.max(0, Math.floor(Number(p && p.count) || 0));
          if (!name) return;
          var row = addRow(name, count);
          layouts.push({ id: Number(row.dataset.id), box: wyeBox(p.box), manualSize: p.manualSize == null ? null : wyeNumber(p.manualSize, .1, 96) });
        });
        if (!el.peopleList.children.length) addRow();
        applyRoster();
        // 전에 고쳐 둔 위치 · 글자 크기를 되살린다.
        layouts.forEach(function (layout) {
          var person = state.people.find(function (item) { return item.id === layout.id; });
          if (!person) return;
          person.box = layout.box;
          person.manualSize = layout.manualSize;
        });
        renderAll();
        document.fonts.ready.then(function () { requestAnimationFrame(fitAll); });
        return state.people.length;
      }

      function wyeState() {
        return {
          edition: state.edition,
          experience: state.experience,
          people: state.people.map(function (person) {
            return { name: person.name, count: person.count, box: person.box || null, manualSize: person.manualSize == null ? null : person.manualSize };
          })
        };
      }

      if (wyeEmbedded) {
        window.addEventListener("message", function (event) {
          if (event.source !== window.parent) return;
          var data = event.data;
          if (!data || typeof data !== "object") return;
          if (event.origin && event.origin !== "null") wyeParentOrigin = event.origin;
          if (data.type === "wye-badge-roster") {
            var count = wyeLoadRoster(data);
            window.parent.postMessage({ type: "wye-badge-loaded", count: count }, wyeParentOrigin);
          } else if (data.type === "wye-badge-get-state") {
            // 입력칸에만 있고 아직 반영하지 않은 값도 담기게 먼저 반영한다.
            var ok = applyRoster();
            window.parent.postMessage({ type: "wye-badge-state", ok: ok, state: wyeState() }, wyeParentOrigin);
          }
        });
        // 예시 명단을 비우고 명단을 기다린다.
        el.peopleList.replaceChildren();
        state.people = [];
        state.selectedId = null;
        addRow();
        renderAll();
        window.parent.postMessage({ type: "wye-badge-ready" }, "*");
      }
      window.__badgeMaker.loadRoster = wyeLoadRoster;
      window.__badgeMaker.exportState = wyeState;
      /* wye-bridge:end */
