// chart5.js
// Doanh số bán hàng TRUNG BÌNH theo ngày trong tháng (1 → 31)
// = tính tổng theo mỗi ngày (yyyy-mm-dd) rồi lấy trung bình theo day-of-month

function parseNumber(v) {
  if (v == null) return 0;
  const s = String(v).replace(/[^\d\.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDateSafe(s) {
  if (!s) return null;
  let d = new Date(s);
  if (!isNaN(d)) return d;
  const t1 = d3.timeParse("%Y-%m-%d %H:%M:%S")(s);
  if (t1) return t1;
  const t2 = d3.timeParse("%Y-%m-%d")(s);
  if (t2) return t2;
  const s2 = s.replace('T', ' ').split('.')[0];
  d = new Date(s2);
  return isNaN(d) ? null : d;
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

d3.csv("data_ggsheet.csv").then(raw => {
  // parse
  raw.forEach(r => {
    r._dateObj = parseDateSafe(r["Thời gian tạo đơn"]);
    r._revenue = parseNumber(r["Thành tiền"]);
    r._qty = parseNumber(r["SL"]);
  });

  const withDate = raw.filter(r => r._dateObj);

  // 1) Tổng doanh số & số lượng cho từng ngày (yyyy-mm-dd)
  const perDate = d3.rollup(
    withDate,
    rows => ({
      revenue: d3.sum(rows, r => r._revenue),
      qty: d3.sum(rows, r => r._qty)
    }),
    r => {
      const d = r._dateObj;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  );

  // make array of daily totals (one entry per actual date)
  const dailyTotals = Array.from(perDate, ([dateKey, val]) => {
    const d = new Date(dateKey);
    return {
      dateKey,
      dateObj: d,
      day: d.getDate(),        // 1..31
      revenue: val.revenue,
      qty: val.qty
    };
  });

  // 2) Nhóm theo day-of-month (1..31) và LẤY TRUNG BÌNH của các daily totals
  const perDayOfMonth = d3.rollup(
    dailyTotals,
    rows => ({
      avgRevenue: d3.mean(rows, r => r.revenue),
      avgQty: d3.mean(rows, r => r.qty),
      nDays: rows.length
    }),
    r => r.day
  );

  // Build final array for days 1..31 (fill 0 when missing)
  const days = d3.range(1, 32);
  const data = days.map(d => {
    const v = perDayOfMonth.get(d);
    return {
      day: d,
      avgRevenue: v ? v.avgRevenue : 0,
      avgQty: v ? v.avgQty : 0,
      nDays: v ? v.nDays : 0
    };
  });

  // ---------- layout & scales (style same as chart4) ----------
  const margin = { top: 50, right: 40, bottom: 70, left: 100 };
  const innerWidth = 900;
  const innerHeight = 420;
  const svgW = margin.left + innerWidth + margin.right;
  const svgH = margin.top + innerHeight + margin.bottom;

  d3.select("#chart5").selectAll("*").remove();
  const svg = d3.select("#chart5").append("svg")
    .attr("width", svgW)
    .attr("height", svgH);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => String(d.day)))
    .range([0, innerWidth])
    .paddingInner(0.25)
    .paddingOuter(0.12);

  const y = d3.scaleLinear()
    .domain([0, (d3.max(data, d => d.avgRevenue) || 1) * 1.15])
    .nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal().domain(data.map(d => d.day)).range(d3.schemeSet2);

  // grid ngang
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").attr("stroke", "#eee").attr("stroke-dasharray", "3,3"));

  // X axis (days)
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(data.map(d => String(d.day)))) // show 1..31
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // Y axis in M (triệu)
  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => (d / 1e6) + "M"))
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // tooltip (use your style.css .tooltip)
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  // bars
  g.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(String(d.day)))
    .attr("y", d => y(d.avgRevenue))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.avgRevenue))
    .attr("rx", 6)
    .attr("fill", d => color(d.day))
    .on("mouseover", function(event, d) {
      // darker fill
      const orig = color(d.day);
      const dark = d3.color(orig).darker(0.6).formatHex();
      d3.select(this).attr("fill", dark);
      tooltip.style("visibility", "visible").html(
        `<b>Ngày ${escapeHtml(String(d.day))}</b><br/>
         Doanh số bán TB: ${d3.format(",.0f")(d.avgRevenue)} VND<br/>
         Số lượng bán TB: ${d.avgQty ? d3.format(",.0f")(d.avgQty) : 0} SKUs
         `
      );
    })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.pageX + 12) + "px")
             .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(event, d) {
      d3.select(this).attr("fill", color(d.day));
      tooltip.style("visibility", "hidden");
    });

  // labels on top (format in M for consistency)
  g.selectAll(".barValue")
    .data(data)
    .enter().append("text")
    .attr("class", "barValue")
    .attr("x", d => x(String(d.day)) + x.bandwidth() / 2)
    .attr("y", d => y(d.avgRevenue) - 8)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#222")
    .text(d => d.avgRevenue > 0 ? ( (d.avgRevenue / 1e6).toFixed(1) + "tr") : "");

  // title
  svg.append("text")
    .attr("x", svgW / 2)
    .attr("y", 26)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "700")
    .text("Doanh số bán hàng trung bình theo ngày trong tháng");
});
