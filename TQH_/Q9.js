// Q9.js
// Dashboard trực quan: "Xác suất bán theo Mặt hàng trong từng Nhóm hàng"
// Format chuẩn dashboard, dựa logic Python

(function(){
  const CSV_FILE = "data_ggsheet.csv";

  function parseNumber(v) {
    if (v == null) return 0;
    const s = String(v).replace(/[^\d\.\-\,]/g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // tooltip
  let tooltip = d3.select("body").select(".tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div").attr("class", "tooltip");
  }

  d3.csv(CSV_FILE).then(raw => {
    raw.forEach(d => {
      d.orderId = d["Mã đơn hàng"];
      d.groupId = d["Mã nhóm hàng"];
      d.groupName = d["Tên nhóm hàng"];
      d.itemId = d["Mã mặt hàng"];
      d.itemName = d["Tên mặt hàng"];
    });

    // === Logic Python: tính xác suất ===
    const ordersPerGroup = d3.rollup(raw, v => new Set(v.map(d => d.orderId)).size, d => d.groupId);
    const ordersPerItem = d3.rollup(
      raw,
      v => new Set(v.map(d => d.orderId)).size,
      d => d.groupId,
      d => d.itemId
    );

    let prob = [];
    ordersPerItem.forEach((itemMap, g) => {
      const totalOrders = ordersPerGroup.get(g) || 1;
      itemMap.forEach((soDon, it) => {
        const row = raw.find(r => r.groupId === g && r.itemId === it) || {};
        prob.push({
          groupId: g,
          groupName: row.groupName ?? g,
          itemId: it,
          itemName: row.itemName ?? it,
          orders: soDon,
          prob: soDon / totalOrders
        });
      });
    });

    const groups = Array.from(d3.group(prob, d => d.groupId), ([k,v]) => ({
      id: k,
      name: v[0].groupName,
      values: v.sort((a,b) => d3.descending(a.prob, b.prob))
    }));

    // Grid layout (3 cột)
    const nCols = 3;
    const cellW = 450, cellH = 290;   // 👉 tăng chiều ngang cell
    const svgW = nCols * cellW;
    const svgH = Math.ceil(groups.length / nCols) * cellH + 60;

    const svg = d3.select("#chart9")
      .append("svg")
      .attr("width", svgW)
      .attr("height", svgH);

    // Dashboard title
    svg.append("text")
      .attr("x", svgW/2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", 20)
      .attr("font-weight", "700")
      .text("Xác suất bán theo Mặt hàng trong từng Nhóm hàng");

    const color = d3.scaleOrdinal(d3.schemeSet3);

    groups.forEach((g, i) => {
      const col = i % nCols;
      const row = Math.floor(i / nCols);
      const x0 = col * cellW;
      const y0 = row * cellH + 60;

      const margin = { top: 40, right: 20, bottom: 60, left: 140 };
      const innerW = cellW - margin.left - margin.right;
      const innerH = cellH - margin.top - margin.bottom;

      const x = d3.scaleLinear()
        .domain([0, d3.max(g.values, d => d.prob) || 0.01])
        .range([0, innerW]);

      const y = d3.scaleBand()
        .domain(g.values.map(d => d.itemName))
        .range([0, innerH])
        .padding(0.2);

      const panel = svg.append("g")
        .attr("transform", `translate(${x0 + margin.left},${y0 + margin.top})`);

      // Panel title (trục Y label)
      svg.append("text")
        .attr("x", x0 + cellW/2)
        .attr("y", y0 + 20)
        .attr("text-anchor", "middle")
        .attr("font-weight", "700")
        .text(`[${g.id}] ${g.name}`);

      // Axes
      panel.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .attr("font-size", 11);

      panel.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).tickFormat(d3.format(".0%")))
        .selectAll("text")
        .attr("transform", "rotate(45)")
        .style("text-anchor", "start")
        .style("font-size", "10px");

      panel.selectAll("path,line")
        .attr("stroke", "#ccc");

      // Bars
      panel.selectAll("rect")
        .data(g.values)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", d => y( d.itemName))
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.prob))
        .attr("rx", 6)   // bo tròn góc
        .attr("ry", 6)
        .attr("fill", d => color(d.itemId))
        .on("mouseover", (event,d) => {
          tooltip.style("visibility","visible")
            .html(`<b> ${escapeHtml(d.itemName)}</b><br/>
                   Đơn hàng: ${d.orders}<br/>
                   Xác suất: ${d3.format(".1%")(d.prob)}`);
        })
        .on("mousemove", (event) => {
          tooltip.style("top",(event.pageY-30)+"px")
                 .style("left",(event.pageX+10)+"px");
        })
        .on("mouseout", () => tooltip.style("visibility","hidden"));

      // Value text (hiển thị ngay trên bar) - màu trắng
      panel.selectAll(".barValue")
        .data(g.values)
        .enter()
        .append("text")
        .attr("x", d => x(d.prob) - 5)
        .attr("y", d => y(d.itemName) + y.bandwidth()/2 + 4)
        .attr("text-anchor", "end")
        .attr("fill", "white")   // đổi thành màu trắng
        .attr("font-size", 11)
        .attr("font-weight", "600")
        .text(d => d3.format(".1%")(d.prob));
    });

  }).catch(err => {
    console.error(err);
    d3.select("#chart9").append("div").style("color","red")
      .text("Không load được file CSV!");
  });
})();
